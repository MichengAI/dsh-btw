/** Real command-to-model regression with a paused parent stream. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import * as plugin from '../lib/index.js'

const runtime = process.env.DSH_RUNTIME_ROOT ?? fileURLToPath(new URL('../node_modules/', import.meta.url))
const require = createRequire(resolve(runtime, '../package.json'))
const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`, { paths: [runtime] })).href)
const { Context, Service } = await load('cordis')
const { default: AgentRegistry } = await load('dsh-agent')
const { default: AgentLoop } = await load('dsh-agent-loop')
const { default: Commands } = await load('dsh-commands')
const { default: Llm, LlmAdapter, createUserMessage, ToolCallId } = await load('dsh-llm')
const { default: Sessions, SessionId } = await load('dsh-session')
const { default: Projections } = await load('dsh-session-projection')
const { default: Subagents } = await load('dsh-subagent')
const Fork = await load('dsh-subagent-fork-in-process')
const { default: SystemPrompt } = await load('dsh-system-prompt')
const { default: Tools } = await load('dsh-tools')

class Directory extends Service {
  constructor(ctx) { super(ctx, 'workingDirectory') }
  get(session) { return session.header.cwd }
  async ensure(agent) { return agent.session.header.cwd ?? process.cwd() }
  async set(_agent, path) { return path }
}
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
function* textResponse(text) {
  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text }
  yield { type: 'block-end', index: 0, block: { type: 'text', text } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

for (const [warmup, phase] of [[false, 'stream'], [true, 'stream'], [false, 'tool'], [true, 'tool']]) {
  test(`btw sees a running ${warmup ? 'second' : 'first'} turn during ${phase}`, { timeout: 15000 }, async () => {
    const ctx = new Context()
    const streamed = deferred()
    const release = deferred()
    const childRequest = deferred()
    let parent
    let child
    let toolCalls = 0
    let active = false
    let step = 0
    class Adapter extends LlmAdapter {
      async resolveModel(provider, model) { return { provider, id: model, name: model } }
      async *stream(options) {
        if (options.sessionId !== 'live-parent') {
          childRequest.resolve(options)
          yield* textResponse('SIDE_ONLY_ANSWER')
          return
        }
        if (!active) { yield* textResponse('PREVIOUS_ANSWER'); return }
        if (step++ === 0) {
          const id = ToolCallId('read-current')
          yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'read_current', arguments: '{}' } }
          yield { type: 'finish', reason: { kind: 'tool-calls' } }
          return
        }
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'LIVE_STREAM_MARKER' }
        streamed.resolve()
        await release.promise
        yield { type: 'text-delta', index: 0, text: ' AFTER_SNAPSHOT' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'LIVE_STREAM_MARKER AFTER_SNAPSHOT' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    try {
      new Directory(ctx)
      for (const service of [Llm, Sessions, Projections, SystemPrompt, Tools, AgentRegistry, Commands]) await ctx.plugin(service)
      await ctx.plugin(AgentLoop, { agents: [] })
      await ctx.plugin(Subagents)
      await ctx.plugin(Fork, { providerName: 'fork' })
      ctx.llm.registerAdapter(['test'], new Adapter())
      ctx.tools.register({ name: 'read_current', description: 'Read current data', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: async () => { toolCalls++; if (phase === 'tool') { streamed.resolve(); await release.promise } return 'CURRENT_TOOL_RESULT' } })
      await ctx.plugin(plugin)
      parent = await ctx.agentLoop.create(SessionId('live-parent'), { provider: 'test', model: 'test' }, { cwd: process.cwd() })
      const send = text => parent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] }))
      if (warmup) { send('PREVIOUS_QUESTION'); await parent.whenIdle() }
      active = true
      send('CURRENT_USER_QUESTION')
      await streamed.promise
      ctx.on('agent/created', ({ agent }) => { if (agent !== parent) child = agent })
      const line = warmup
        ? `/btw-run ${JSON.stringify({ id: 'live-context-question', question: 'Explain the current work', reference: 'FIXED_QUOTE' })}`
        : '/btw Explain the current work'
      const response = await ctx.commands.execute(parent, line, [], new AbortController().signal)
      assert.equal(response.result.kind, 'success')
      const request = await childRequest.promise
      const input = JSON.stringify(request.messages)
      assert.match(input, /CURRENT_USER_QUESTION/)
      if (phase === 'stream') {
        assert.match(input, /CURRENT_TOOL_RESULT/)
        assert.match(input, /LIVE_STREAM_MARKER/)
      } else {
        assert.match(input, /read_current/)
        assert.doesNotMatch(input, /CURRENT_TOOL_RESULT|LIVE_STREAM_MARKER/)
      }
      assert.doesNotMatch(input, /AFTER_SNAPSHOT/)
      if (warmup) { assert.match(input, /PREVIOUS_QUESTION/); assert.match(input, /FIXED_QUOTE/) }

      assert.match(JSON.stringify(child.session.deriveMessages()), /CURRENT_USER_QUESTION/)
      assert.doesNotMatch(JSON.stringify(parent.session.deriveMessages()), /SIDE_ONLY_ANSWER|Explain the current work/)
      assert.deepEqual(request.tools ?? [], [])
      assert.equal(toolCalls, 1)
      release.resolve()
      await parent.whenIdle()
      assert.match(JSON.stringify(parent.session.deriveMessages()), /AFTER_SNAPSHOT/)
    } finally {
      release.resolve()
      await parent?.whenIdle()
      await ctx.fiber.dispose()
    }
  })
}
