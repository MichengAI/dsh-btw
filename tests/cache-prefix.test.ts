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
 * Provider prompt caches reuse only a byte-identical request PREFIX, laid out
 * as tools → system → messages. Report how much of the side question's first
 * request is a byte-identical prefix of the parent's latest request.
 */
function sharedPrefix(parent: GenerateOptions, child: GenerateOptions) {
  const toolsEqual = JSON.stringify(parent.tools ?? []) === JSON.stringify(child.tools ?? [])
  let messages = 0
  while (
    messages < parent.messages.length
    && messages < child.messages.length
    && JSON.stringify(parent.messages[messages]) === JSON.stringify(child.messages[messages])
  ) messages++
  // The loop puts the system prompt in the leading system-role message, so a
  // changed system prompt shows up as zero shared messages.
  return { toolsEqual, systemEqual: messages > 0, sharedMessages: toolsEqual ? messages : 0, parentMessages: parent.messages.length }
}

it('旁问首个请求复用主会话最近一次请求的完整前缀（工具定义、系统提示与全部已完成历史）', async () => {
  const ctx = new Context()
  try {
    new MemoryWorkingDirectory(ctx)
    for (const s of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) await ctx.plugin(s).await()
    await ensureExecutor(ctx)
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(SubagentRuntime).await()
    await ctx.plugin(Fork, { providerName: 'fork' }).await()
    ctx.tools.register({
      name: 'read_file',
      description: '读取指定文件',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      output: { schema: { type: 'string' }, render: (value: unknown) => [{ type: 'text', text: String(value) }] },
      execute: async () => 'FILE_CONTENT',
    })

    const requests: GenerateOptions[] = []
    class Adapter extends LlmAdapter {
      async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
      async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        requests.push(options)
        if (requests.length === 1) {
          const id = ToolCallId('call-1')
          yield { type: 'block-start', index: 0, blockType: 'tool-call' }
          yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'read_file', arguments: JSON.stringify({ path: 'a.ts' }) } }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
          return
        }
        const text = requests.length === 2 ? '主任务回答' : '旁问回答'
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['test'], new Adapter())
    const parent = await ctx.agentLoop.create(SessionId('cache-parent'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '读 a.ts 并解释' }] }))
    await parent.whenIdle()
    expect(requests).toHaveLength(2)

    await ctx.plugin(sourcePlugin).await()
    const result = await ctx.commands.execute(parent, `/${RUN_COMMAND} ${JSON.stringify({ id: 'cache-req-1', question: '为什么？' })}`, [], new AbortController().signal)
    expect(result?.result).toMatchObject({ kind: 'success', text: '旁问回答' })

    const prefix = sharedPrefix(requests[1]!, requests[2]!)
    console.log('[cache-prefix]', JSON.stringify(prefix))
    expect(prefix.toolsEqual).toBe(true)
    expect(prefix.systemEqual).toBe(true)
    // Every message the parent sent last time is reused; only the side question is new.
    expect(prefix.sharedMessages).toBe(prefix.parentMessages)
  } finally { await ctx.fiber.dispose() }
})
