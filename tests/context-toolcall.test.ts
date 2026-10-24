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
import { describe, expect, it } from 'vitest'
import * as sourcePlugin from '../src/index'
import { RUN_COMMAND } from '../src/shared'

class MemoryWorkingDirectory extends Service {
  constructor(ctx: Context) { super(ctx, 'workingDirectory') }
  get(session: { header: { cwd?: string } }) { return session.header.cwd }
  async ensure(agent: { session: { header: { cwd?: string } } }) { return agent.session.header.cwd ?? process.cwd() }
  async set(_agent: unknown, path: string) { return path }
}

describe('继承父会话包含工具调用时的旁问隔离与反污染约束', () => {
  it('验证 1：子代理继承的 messages 包含父会话的 tool-call 与 tool/result，工具定义与主会话一致（复用 prompt cache）且末尾注入强反工具约束', async () => {
    const ctx = new Context()
    try {
      new MemoryWorkingDirectory(ctx)
      for (const s of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) {
        await ctx.plugin(s).await()
      }
      await ctx.plugin(AgentLoop, { agents: [] }).await()
      await ctx.plugin(SubagentRuntime).await()
      await ctx.plugin(Fork, { providerName: 'fork' }).await()

      // 注册一个测试工具
      ctx.tools.register({
        name: 'read_file',
        description: '读取指定文件',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        output: { schema: { type: 'string' }, render: v => [{ type: 'text', text: String(v) }] },
        execute: async ({ arguments: args }) => `FILE_CONTENT: mock content of ${(args as { path: string }).path}`,
      })

      const requests: GenerateOptions[] = []
      let turnStep = 0

      class MockLlmAdapter extends LlmAdapter {
        async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
        async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
          requests.push(options)
          turnStep++

          // 步骤 1：主会话第 1 步，模型发起 read_file 工具调用
          if (turnStep === 1) {
            const callId = ToolCallId('call-101')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'tool-call-delta', index: 0, id: callId, name: 'read_file', argumentsDelta: JSON.stringify({ path: 'config.json' }) }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'read_file', arguments: JSON.stringify({ path: 'config.json' }) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }

          // 步骤 2：主会话第 2 步（工具返回后），模型给出自然语言总结并完成该轮
          if (turnStep === 2) {
            const text = '文件已读完，配置项包含 debug: true'
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text }
            yield { type: 'block-end', index: 0, block: { type: 'text', text } }
            yield { type: 'finish', reason: { kind: 'stop' } }
            return
          }

          // 步骤 3：BTW 子代理启动后请求大模型
          const text = '这是 BTW 旁问给出的正常回答'
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text }
          yield { type: 'block-end', index: 0, block: { type: 'text', text } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        }
      }

      ctx.llm.registerAdapter(['test'], new MockLlmAdapter())

      // 启动主会话
      const parent = await ctx.agentLoop.create(SessionId('parent-issue-10'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
      parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '请帮我读 config.json' }] }))
      await parent.whenIdle()

      // 确认主会话已经完成 2 个步骤（第 1 步 tool-call，第 2 步回复）
      expect(turnStep).toBe(2)
      const parentMessages = parent.session.deriveMessages()
      console.log('--- 父会话派生消息总数:', parentMessages.length)
      const hasToolCallInParent = parentMessages.some(m => m.role === 'assistant' && m.content.some(b => b.type === 'tool-call'))
      const hasToolResultInParent = parentMessages.some(m => m.role === 'tool')
      expect(hasToolCallInParent).toBe(true)
      expect(hasToolResultInParent).toBe(true)

      // 加载 BTW 插件
      const plugin = ctx.plugin(sourcePlugin)
      await plugin.await()

      // 执行 BTW 旁问
      const execute = (line: string) => ctx.commands.execute(parent, line, [], new AbortController().signal)
      const btwRes = await execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'req-issue-10-1', question: '刚刚的 debug 是什么意思？' })}`)

      expect(btwRes?.result.kind).toBe('success')

      // 检查子代理请求大模型时发送的 GenerateOptions
      expect(requests.length).toBe(3)
      const subagentRequest = requests[2]!

      console.log('--- 子代理 tools 定义:', subagentRequest.tools)
      console.log('--- 子代理 messages 角色流:', subagentRequest.messages.map(m => m.role))

      // 验证现象：
      // 1. 工具定义与主会话最近一次请求逐字节一致，前缀才能命中 prompt cache；
      //    工具调用改由 AnswerOnlyGuard 在执行期拒绝（见验证 2）。
      expect(JSON.stringify(subagentRequest.tools ?? [])).toBe(JSON.stringify(requests[1]!.tools ?? []))
      expect((subagentRequest.tools ?? []).map(tool => tool.name)).toContain('read_file')

      // 2. 但 messages 里面包含了父会话的 tool-call 和 tool/result 记录！
      const subagentHasToolCall = subagentRequest.messages.some(m => m.role === 'assistant' && m.content.some(b => b.type === 'tool-call'))
      const subagentHasToolResult = subagentRequest.messages.some(m => m.role === 'tool')
      expect(subagentHasToolCall).toBe(true)
      expect(subagentHasToolResult).toBe(true)

      // 3. 验证修复：子代理用户提问消息中，明确注入了反工具负向约束
      const userMessages = subagentRequest.messages.filter(m => m.role === 'user')
      const targetUserMsg = userMessages.find(m => JSON.stringify(m.content).includes('刚刚的 debug 是什么意思？'))
      const targetUserText = JSON.stringify(targetUserMsg?.content)
      expect(targetUserText).toContain('严禁尝试发起工具调用或输出 <tool_call> 等调用标记')
      expect(targetUserText).toContain('任何工具调用都会被拒绝')

      console.log('【验证 1 成功】子代理在继承工具历史的同时，最新 Prompt 已注入最高权重的禁止工具约束！')

      await plugin.dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  }, 15_000)

  it('验证 2：当模型尝试发起 tool-call 时，被 AnswerOnlyGuard 拦截并进入生命周期受控处理', async () => {
    const ctx = new Context()
    try {
      new MemoryWorkingDirectory(ctx)
      for (const s of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) {
        await ctx.plugin(s).await()
      }
      await ctx.plugin(AgentLoop, { agents: [] }).await()
      await ctx.plugin(SubagentRuntime).await()
      await ctx.plugin(Fork, { providerName: 'fork' }).await()

      ctx.tools.register({
        name: 'read_file',
        description: '读取指定文件',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        output: { schema: { type: 'string' }, render: v => [{ type: 'text', text: String(v) }] },
        execute: async () => 'mock file content',
      })

      let subagentStepCount = 0

      class PollutedModelAdapter extends LlmAdapter {
        async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
        async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
          const isSubagent = options.sessionId !== 'parent-issue-10-2'

          if (!isSubagent) {
            if (options.messages.length <= 2) {
              const callId = ToolCallId('call-101')
              yield { type: 'block-start', index: 0, blockType: 'tool-call' }
              yield { type: 'tool-call-delta', index: 0, id: callId, name: 'read_file', argumentsDelta: JSON.stringify({ path: 'a.txt' }) }
              yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } }
              yield { type: 'finish', reason: { kind: 'tool-calls' } }
            } else {
              yield { type: 'block-start', index: 0, blockType: 'text' }
              yield { type: 'text-delta', index: 0, text: '主任务已读完 a.txt' }
              yield { type: 'block-end', index: 0, block: { type: 'text', text: '主任务已读完 a.txt' } }
              yield { type: 'finish', reason: { kind: 'stop' } }
            }
            return
          }

          // 子代理（BTW）：
          subagentStepCount++

          if (subagentStepCount === 1) {
            // 第 1 步：模型受上下文惯性，尝试调用 read_file 工具
            console.log('--- [子代理 Step 1] 模型受历史污染发起 tool-call: read_file')
            const callId = ToolCallId('call-btw-polluted')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'tool-call-delta', index: 0, id: callId, name: 'read_file', argumentsDelta: JSON.stringify({ path: 'another.txt' }) }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'read_file', arguments: JSON.stringify({ path: 'another.txt' }) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }

          if (subagentStepCount === 2) {
            // 第 2 步：查看宿主返回给模型的错误
            const lastMsg = options.messages.at(-1)
            console.log('--- [子代理 Step 2] 宿主拦截后回传给模型的错误结果:', JSON.stringify(lastMsg))
            const text = '抱歉，工具被拒绝执行，无法读取 another.txt'
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text }
            yield { type: 'block-end', index: 0, block: { type: 'text', text } }
            yield { type: 'finish', reason: { kind: 'stop' } }
            return
          }
        }
      }

      ctx.llm.registerAdapter(['test'], new PollutedModelAdapter())

      const parent = await ctx.agentLoop.create(SessionId('parent-issue-10-2'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
      parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '主任务读 a.txt' }] }))
      await parent.whenIdle()

      const plugin = ctx.plugin(sourcePlugin)
      await plugin.await()

      const execute = (line: string) => ctx.commands.execute(parent, line, [], new AbortController().signal)
      const btwRes = await execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'req-issue-10-2', question: '请帮我分析一下另外的文件' })}`)

      console.log('--- BTW 执行结果:', btwRes?.result)
      expect(subagentStepCount).toBe(2)
      expect(btwRes?.result.text).toContain('抱歉，工具被拒绝执行')
      console.log('【复现确认 2 成功】模型尝试 toolcall 时被拦截，触发额外回合与异常回答！')

      await plugin.dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  }, 15_000)

  it('验证 3：输出容错清洗——当模型文本中混杂 <tool_call> 伪代码时，自动剔除伪影保留干净正文', async () => {
    const ctx = new Context()
    try {
      new MemoryWorkingDirectory(ctx)
      for (const s of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry, CommandRuntime]) {
        await ctx.plugin(s).await()
      }
      await ctx.plugin(AgentLoop, { agents: [] }).await()
      await ctx.plugin(SubagentRuntime).await()
      await ctx.plugin(Fork, { providerName: 'fork' }).await()

      ctx.tools.register({
        name: 'read_file',
        description: '读取指定文件',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        output: { schema: { type: 'string' }, render: v => [{ type: 'text', text: String(v) }] },
        execute: async () => 'mock file content',
      })

      let turnStep = 0

      class RawToolCallModelAdapter extends LlmAdapter {
        async resolveModel(provider: string, model: string) { return { provider, id: model, name: model } }
        async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
          turnStep++

          // 步骤 1 & 2：主会话完成正常 toolcall
          if (turnStep === 1) {
            const callId = ToolCallId('call-101')
            yield { type: 'block-start', index: 0, blockType: 'tool-call' }
            yield { type: 'tool-call-delta', index: 0, id: callId, name: 'read_file', argumentsDelta: JSON.stringify({ path: 'a.txt' }) }
            yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: callId, name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } }
            yield { type: 'finish', reason: { kind: 'tool-calls' } }
            return
          }
          if (turnStep === 2) {
            yield { type: 'block-start', index: 0, blockType: 'text' }
            yield { type: 'text-delta', index: 0, text: '主任务已读完 a.txt' }
            yield { type: 'block-end', index: 0, block: { type: 'text', text: '主任务已读完 a.txt' } }
            yield { type: 'finish', reason: { kind: 'stop' } }
            return
          }

          // 步骤 3：模型输出中混杂了自然语言与残留的 tool_call 标签伪影
          const mixedOutput = '根据上文记录分析，配置已经在主会话中完成加载。<tool_call>\n{"name": "read_file", "arguments": {"path": "b.txt"}}\n</tool_call>\n结论是无需重新读取，直接查看当前状态即可。'
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text: mixedOutput }
          yield { type: 'block-end', index: 0, block: { type: 'text', text: mixedOutput } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        }
      }

      ctx.llm.registerAdapter(['test'], new RawToolCallModelAdapter())

      const parent = await ctx.agentLoop.create(SessionId('parent-issue-10-3'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
      parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '主任务读 a.txt' }] }))
      await parent.whenIdle()

      const plugin = ctx.plugin(sourcePlugin)
      await plugin.await()

      const execute = (line: string) => ctx.commands.execute(parent, line, [], new AbortController().signal)
      const btwRes = await execute(`/${RUN_COMMAND} ${JSON.stringify({ id: 'req-issue-10-3', question: '请帮我看看 b.txt' })}`)

      console.log('--- BTW 清洗后的文本输出内容:', btwRes?.result)

      // 验证清洗结果：
      // <tool_call> 标签已被完全剥离，只保留自然语言正文
      expect(btwRes?.result.kind).toBe('success')
      expect(btwRes?.result.text).not.toContain('<tool_call>')
      expect(btwRes?.result.text).toContain('根据上文记录分析，配置已经在主会话中完成加载。')
      expect(btwRes?.result.text).toContain('结论是无需重新读取，直接查看当前状态即可。')
      console.log('【验证 3 成功】伪代码标签被彻底清除，用户获得干净的正文回答！')

      await plugin.dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  }, 15_000)
})
