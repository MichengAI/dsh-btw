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


// alpha.3：SubagentRuntime / 本地 fork 依赖 workingDirectory（ensure/set）。
class MemoryWorkingDirectory extends Service {
  constructor(ctx: Context) { super(ctx, 'workingDirectory') }
  get(session: { header: { cwd?: string } }) { return session.header.cwd }
  async ensure(agent: { session: { header: { cwd?: string } } }) { return agent.session.header.cwd ?? process.cwd() }
  async set(_agent: unknown, path: string) { return path }
}

it('真实 fork 继承已完成上下文、独立回答并可取消，主任务保持可用', async () => {
  const ctx = new Context()
  try {
    new MemoryWorkingDirectory(ctx)
    for (const service of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) await ctx.plugin(service).await()
    if (typeof (ctx as any).tools?.setExecutor === 'function') {
      const pipelinePath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/pipeline.js', import.meta.url).href
      const toolsPath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/index.js', import.meta.url).href
      const { ToolExecutionPipeline, executeToolBatch } = await import(/* @vite-ignore */ pipelinePath)
      const { projectToolSchema } = await import(/* @vite-ignore */ toolsPath) as { projectToolSchema: (d: any, f: boolean) => any }
      const pipeline = new ToolExecutionPipeline(ctx)
      ;(ctx as any).tools.setExecutor({
        describe: (tools: any[]) => ({ schemas: tools.map(t => projectToolSchema(t, false)) }),
        execute: (input: any) => executeToolBatch(input, pipeline, () => 10),
      })
    }
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(SubagentRuntime).await()
    await ctx.plugin(Fork, { providerName: 'fork' }).await()
    const adapter = new AnswerAdapter()
    ctx.llm.registerAdapter(['test'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('btw-parent'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '主任务背景' }] }))
    await parent.whenIdle()
    const bundle = new URL('../lib/index.js', import.meta.url).href
    const implementation = process.env.DSH_BTW_BUNDLE === '1' ? await import(/* @vite-ignore */ bundle) as typeof sourcePlugin : sourcePlugin
    const plugin = ctx.plugin(implementation)
    await plugin.await()
    const execute = (line: string) => ctx.commands.execute(parent, line, [], new AbortController().signal)
    const answered = await execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'request01', question: '旁问专属问题', reference: '选中时固定的正文片段' })}`)
    expect(answered?.result).toMatchObject({ kind: 'success', text: '独立旁问答案' })
    const request = adapter.requests.at(-1)!
    expect(JSON.stringify(request.messages)).toContain('主任务背景')
    expect(JSON.stringify(request.messages)).toContain('旁问专属问题')
    expect(JSON.stringify(request.messages)).toContain('选中时固定的正文片段')
    // 旁问说明位于提问消息内（种子之后），宿主的 subagent:delegation 运行时上下文追加在最末。
    expect(JSON.stringify(request.messages.find(m => JSON.stringify(m).includes('旁问专属问题')))).toContain('一次性旁问')
    // 不改系统提示与工具定义：与主会话最近一次请求一致，复用 prompt cache。
    const parentRequest = adapter.requests[0]!
    expect(JSON.stringify(request.tools ?? [])).toBe(JSON.stringify(parentRequest.tools ?? []))
    expect(JSON.stringify(request.messages[0])).toBe(JSON.stringify(parentRequest.messages[0]))
    // 命令结果会进入审计日志，但不得进入主任务的模型上下文。
    expect(JSON.stringify(parent.session.deriveMessages())).not.toContain('独立旁问答案')
    expect(JSON.stringify(parent.session.deriveMessages())).not.toContain('选中时固定的正文片段')
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

it('真实宿主下旁问回传 send_message 只放行直接父会话并防二级子代理越权 "lead"', async () => {
  const ctx = new Context()
  try {
    new MemoryWorkingDirectory(ctx)
    for (const service of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) await ctx.plugin(service).await()
    if (typeof (ctx as any).tools?.setExecutor === 'function') {
      const pipelinePath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/pipeline.js', import.meta.url).href
      const toolsPath = new URL('../node_modules/@deepseek-ai/dsh-tools/lib/index.js', import.meta.url).href
      const { ToolExecutionPipeline, executeToolBatch } = await import(/* @vite-ignore */ pipelinePath)
      const { projectToolSchema } = await import(/* @vite-ignore */ toolsPath) as { projectToolSchema: (d: any, f: boolean) => any }
      const pipeline = new ToolExecutionPipeline(ctx)
      ;(ctx as any).tools.setExecutor({
        describe: (tools: any[]) => ({ schemas: tools.map(t => projectToolSchema(t, false)) }),
        execute: (input: any) => executeToolBatch(input, pipeline, () => 10),
      })
    }
    await ctx.plugin(AgentLoop, { agents: [] }).await()
    await ctx.plugin(SubagentRuntime).await()
    await ctx.plugin(Fork, { providerName: 'fork' }).await()

    ctx.provide('sessionQuery', {
      observeSession: async (sessionId: string) => {
        const agent = ctx.agents.get(sessionId as any)
        const snapshot = agent ? ctx.sessionProjections.snapshot(agent.session, ['subagentCatalog' as any]) : undefined
        return {
          projections: snapshot,
          [Symbol.dispose]() {},
        }
      },
    })

    const subagents = ctx.subagents as any
    const isModernSubagent = typeof subagents.rootOf === 'function'
    const delivered: Array<{ target: string; message: string; callerId?: string }> = []
    ctx.tools.register({
      name: 'send_message',
      description: 'Send a message to an agent.',
      parameters: isModernSubagent
        ? { type: 'object', properties: { agent: { type: 'string' }, message: { type: 'string' } }, required: ['agent', 'message'] }
        : { type: 'object', properties: { agent_id: { type: 'string' }, message: { type: 'string' } }, required: ['agent_id', 'message'] },
      output: { schema: { type: 'string' }, render: v => [{ type: 'text', text: String(v) }] },
      execute: async (rawArgs: unknown, exec: any) => {
        const args = rawArgs as { agent?: string; agent_id?: string; message: string }
        const targetRef = args.agent ?? args.agent_id ?? ''
        if (isModernSubagent && exec.agent) {
          const targetId = await subagents.resolveName(exec.agent, targetRef, exec.signal)
          await subagents.sendMessage(exec.agent, targetId, [{ type: 'text', text: args.message }], { signal: exec.signal })
        }
        delivered.push({ target: targetRef, message: args.message, callerId: exec.agent?.id })
        return 'sent'
      },
    })

    const requests: GenerateOptions[] = []
    let rootBtwStep = 0
    let nestedBtwStep = 0
    let releaseWorker!: () => void
    const workerGate = new Promise<void>(resolve => { releaseWorker = resolve })
    class ReplyAdapter extends LlmAdapter {
      async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
      async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        requests.push(options)
        const promptText = JSON.stringify(options.messages)
        if (promptText.includes('worker 任务')) {
          await Promise.race([
            workerGate,
            new Promise<void>((_resolve, reject) => {
              if (options.signal?.aborted) { reject(new Error('worker aborted')); return }
              options.signal?.addEventListener('abort', () => reject(new Error('worker aborted')), { once: true })
            }),
          ])
          const text = 'worker 任务结束'
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'block-end', index: 0, block: { type: 'text', text } }
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        if (promptText.includes('根会话要求回传')) {
          rootBtwStep++
          if (rootBtwStep === 1) {
            const c1 = ToolCallId('call-bad')
            const badArgs = isModernSubagent ? { agent: 'other', message: '越权' } : { agent_id: 'other', message: '越权' }
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: c1, name: 'send_message', arguments: JSON.stringify(badArgs) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          if (rootBtwStep === 2) {
            const c2 = ToolCallId('call-good')
            const goodArgs = isModernSubagent ? { agent: 'lead', message: '根结论' } : { agent_id: 'btw-reply-root', message: '根结论' }
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: c2, name: 'send_message', arguments: JSON.stringify(goodArgs) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          const text = '已回传给根会话'
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'block-end', index: 0, block: { type: 'text', text } }
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        if (promptText.includes('二级子代理要求回传')) {
          nestedBtwStep++
          if (nestedBtwStep === 1) {
            // 二级子代理里试图把答案发给 "lead"（祖父）必须被拒！
            const c1 = ToolCallId('call-lead-escalate')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: c1, name: 'send_message', arguments: JSON.stringify({ agent: 'lead', message: '越权祖父' }) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          if (nestedBtwStep === 2) {
            // 发给直接父代理 'worker' 必须放行！
            const c2 = ToolCallId('call-worker-ok')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: c2, name: 'send_message', arguments: JSON.stringify({ agent: 'worker', message: '直接父结论' }) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          const text = '已回传给worker'
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'block-end', index: 0, block: { type: 'text', text } }
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        const text = '普通回合完成'
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['test'], new ReplyAdapter())
    const parent = await ctx.agentLoop.create(SessionId('btw-reply-root'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
    parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '主任务准备' }] }))
    await parent.whenIdle()

    const bundle = new URL('../lib/index.js', import.meta.url).href
    const implementation = process.env.DSH_BTW_BUNDLE === '1' ? await import(/* @vite-ignore */ bundle) as typeof sourcePlugin : sourcePlugin
    const plugin = ctx.plugin(implementation)
    await plugin.await()

    // 1. 根会话旁问回传验证
    const resRoot = await ctx.commands.execute(parent, `/${RUN_COMMAND} ${JSON.stringify({ id: 'reply-root-1', question: '根会话要求回传' })}`, [], new AbortController().signal)
    expect(resRoot?.result).toMatchObject({ kind: 'success', text: '已回传给根会话' })
    await parent.whenIdle()
    expect(delivered).toHaveLength(1)
    expect(delivered[0]).toMatchObject({
      target: isModernSubagent ? 'lead' : 'btw-reply-root',
      message: '根结论',
    })

    // 2. 0.2.2-rc.2+ 二级子代理旁问防越权验证
    if (isModernSubagent) {
      const workerAct = await subagents.startActivation({
        provider: 'fork',
        name: 'worker',
        label: 'worker',
        parent,
        prompt: [{ type: 'text', text: 'worker 任务' }],
        signal: new AbortController().signal,
        delivery: 'caller',
      })
      const workerAgent = ctx.agents.get(workerAct.childId)!
      expect(workerAgent).toBeDefined()
      const resNested = await ctx.commands.execute(workerAgent, `/${RUN_COMMAND} ${JSON.stringify({ id: 'reply-nested-1', question: '二级子代理要求回传' })}`, [], new AbortController().signal)
      expect(resNested?.result).toMatchObject({ kind: 'success', text: '已回传给worker' })
      // 只有直接发给 worker 的那一次被放行，发给 lead（祖父）被拦下
      expect(delivered).toHaveLength(2)
      expect(delivered[1]).toMatchObject({ target: 'worker', message: '直接父结论' })
      expect(JSON.stringify([...workerAgent.inbox.nextStep, ...workerAgent.inbox.nextTurn, ...workerAgent.session.deriveMessages()])).toContain('直接父结论')
      expect(JSON.stringify(parent.session.deriveMessages())).not.toContain('越权祖父')
      releaseWorker()
      await workerAct.result
      await workerAct.dispose()
    }

    await plugin.dispose()
  } finally { await ctx.fiber.dispose() }
}, 15_000)
