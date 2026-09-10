import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LlmRuntime, { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import * as Fork from '@deepseek-ai/dsh-subagent-fork-in-process'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import * as sourcePlugin from '../src/index'
import { CLOSE_COMMAND, RUN_COMMAND } from '../src/shared'

// 仅模型输出可控；AgentLoop、fork、命令、工具限制和生命周期均使用真实宿主。
class AnswerAdapter extends LlmAdapter {
  requests: GenerateOptions[] = []
  hang = false
  async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    if (this.hang) {
      await new Promise<void>((_resolve, reject) => {
        if (options.signal?.aborted) { reject(new Error('已取消')); return }
        options.signal?.addEventListener('abort', () => reject(new Error('已取消')), { once: true })
      })
      return
    }
    const text = this.requests.length === 1 ? '主任务背景已确认' : '独立旁问答案'
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

it('真实 fork 继承已完成上下文、独立回答并可取消，主任务保持可用', async () => {
  const ctx = new Context()
  try {
    for (const service of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) await ctx.plugin(service).await()
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(SubagentRuntime).await()
    await ctx.plugin(Fork, { providerName: 'fork' }).await()
    const adapter = new AnswerAdapter()
    ctx.llm.registerAdapter(['test'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('btw-parent'), { provider: 'test', model: 'test' })
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '主任务背景' }] }))
    await parent.whenIdle()
    const bundle = new URL('../lib/index.js', import.meta.url).href
    const implementation = process.env.DSH_BTW_BUNDLE === '1' ? await import(/* @vite-ignore */ bundle) as typeof sourcePlugin : sourcePlugin
    const plugin = ctx.plugin(implementation)
    await plugin.await()
    const execute = (line: string) => ctx.commands.execute(parent, line, [], new AbortController().signal)
    const answered = await execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'request01', question: '旁问专属问题' })}`)
    expect(answered?.result).toMatchObject({ kind: 'success', text: '独立旁问答案' })
    const request = adapter.requests.at(-1)!
    expect(JSON.stringify(request.messages)).toContain('主任务背景')
    expect(JSON.stringify(request.messages)).toContain('旁问专属问题')
    expect(JSON.stringify({ system: request.system, messages: request.messages })).toContain('一次性旁问助手')
    expect(request.tools ?? []).toEqual([])
    // 命令结果会进入审计日志，但不得进入主任务的模型上下文。
    expect(JSON.stringify(parent.session.deriveMessages())).not.toContain('独立旁问答案')
    await expect.poll(() => ctx.agents.list().length).toBe(1)

    adapter.hang = true
    const pending = execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'request02', question: '等待取消' })}`)
    await expect.poll(() => adapter.requests.length).toBe(3)
    expect((await execute(`/${CLOSE_COMMAND} request02`))?.result.kind).toBe('success')
    expect((await pending)?.result.kind).toBe('error')
    await expect.poll(() => ctx.agents.list().length).toBe(1)
    expect(ctx.agents.get(parent.id)).toBe(parent)
    await plugin.dispose()
    adapter.hang = false
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '继续主任务' }] }))
    await parent.whenIdle()
    expect(adapter.requests).toHaveLength(4)
  } finally { await ctx.fiber.dispose() }
}, 15_000)
