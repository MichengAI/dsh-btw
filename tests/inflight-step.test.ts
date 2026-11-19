import { Context, Service } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LlmRuntime, { createUserMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import * as Fork from '@deepseek-ai/dsh-subagent-fork-in-process'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { expect, it } from 'vitest'
import * as sourcePlugin from '../src/index'
import { RUN_COMMAND } from '../src/shared'

class MemoryWorkingDirectory extends Service {
  constructor(ctx: Context) { super(ctx, 'workingDirectory') }
  get(session: { header: { cwd?: string } }) { return session.header.cwd }
  async ensure(agent: { session: { header: { cwd?: string } } }) { return agent.session.header.cwd ?? process.cwd() }
  async set(_agent: unknown, path: string) { return path }
}

async function ensureExecutor(ctx: any) {
  if (typeof ctx.tools?.setExecutor === 'function') {
    const pipelinePath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/pipeline.js', import.meta.url).href
    const toolsPath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/index.js', import.meta.url).href
    const { ToolExecutionPipeline, executeToolBatch } = await import(/* @vite-ignore */ pipelinePath)
    const { projectToolSchema } = await import(/* @vite-ignore */ toolsPath) as { projectToolSchema: (d: any, f: boolean) => any }
    const pipeline = new ToolExecutionPipeline(ctx)
    ctx.tools.setExecutor({
      describe: (tools: any[]) => ({ schemas: tools.map(t => projectToolSchema(t, false)) }),
      execute: (input: any) => executeToolBatch(input, pipeline, () => 10),
    })
  }
}

/**
 * 复现：主会话正处于尚未完成的 step（工具仍在执行）时发起 /btw。
 * 期望旁问上下文包含该进行中 step 的思考与工具调用；修复前 fork 只用“已完成轮次”，
 * 当前轮尚未 turn/end，种子为空，旁问看不到主会话任何内容。
 */
it('旁问上下文包含主会话正在进行、尚未完成的 step（思考与工具调用）', async () => {
  const ctx = new Context()
  try {
    new MemoryWorkingDirectory(ctx)
    for (const s of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) {
      await ctx.plugin(s).await()
    }
    await ensureExecutor(ctx)
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(SubagentRuntime).await()
    await ctx.plugin(Fork, { providerName: 'fork' }).await()

    const requests: GenerateOptions[] = []
    let parentId = ''
    let asked = false
    let btwResult: any
    let btwChildMessages: readonly any[] | undefined

    class Adapter extends LlmAdapter {
      async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
      async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        requests.push(options)
        if (options.sessionId === parentId) {
          const hasToolResult = options.messages.some(m => m.role === 'tool')
          if (!hasToolResult) {
            const id = ToolCallId('call-slow-1')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'tool-call-delta', index: 0, id, name: 'slow_tool', argumentsDelta: '{}' }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'slow_tool', arguments: '{}' } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: '主任务已完成' }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: '主任务已完成' } }
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        // 旁问子代理请求
        btwChildMessages = options.messages
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: '旁问回答' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '旁问回答' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['test'], new Adapter())

    let parent: any
    ctx.tools.register({
      name: 'slow_tool',
      description: '一个执行时间较长的工具',
      parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'string' }, render: (v: unknown) => [{ type: 'text', text: String(v) }] },
      execute: async () => {
        // 此刻主会话 turn 尚未结束：assistant(tool-call) 已提交，tool/result 尚未产生。
        asked = true
        btwResult = await ctx.commands.execute(
          parent,
          `/${RUN_COMMAND} ${JSON.stringify({ id: 'inflight-step-01', question: '主会话现在正在做什么？' })}`,
          [],
          new AbortController().signal,
        )
        return '慢工具执行完毕'
      },
    })

    const plugin = ctx.plugin(sourcePlugin)
    await plugin.await()

    parent = await ctx.agentLoop.create(SessionId('btw-inflight-parent'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
    parentId = parent.id
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '请执行慢任务并观察' }] }))
    await parent.whenIdle()

    expect(asked).toBe(true)
    expect(btwResult?.result?.kind).toBe('success')
    expect(btwChildMessages).toBeDefined()
    const dumped = JSON.stringify(btwChildMessages)

    // 主会话最初请求
    expect(dumped).toContain('请执行慢任务并观察')
    // 正在进行中的工具调用与思考都必须进入旁问上下文
    expect(dumped).toContain('slow_tool')
    expect(dumped).toContain('"type":"tool-call"')

    await plugin.dispose()
  } finally {
    await ctx.fiber.dispose()
  }
}, 20_000)
