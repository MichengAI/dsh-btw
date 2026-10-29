import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { Context as ContextType } from '@deepseek-ai/cordis'
import type { ToolRuntime as RuntimeType } from '@deepseek-ai/dsh-tools'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { apply } from '../src/index'
import { RUN_COMMAND } from '../src/shared'

/**
 * 设置项的真实宿主接线回归：证明「配置真的走到了执行期与提示词」，
 * 而不只是在 schema 里存在。用真实 `ToolRuntime` 而不是替身，
 * 闸门挂在 `ctx.tools.guard()` 上的链路才被覆盖。
 *
 * 两个时序细节决定了断言必须按下面的方式写：
 * 1. 闸门只认领自己登记的旁问代理（`protection.ownId(childId)`），未认领的 agent
 *    一律放行——这是 1.1.1 既有语义，也是主任务不受影响的原因所在。
 * 2. 结果落地后插件会立刻释放预登记 id（`activation.result.then(release)`），
 *    所以工具调用必须在「子代理还在跑」的时刻发生，也就是在 `startActivation`
 *    的回调里执行，这才是真实的调用位置。
 */

const runtimeRoot = process.env.DSH_RUNTIME_ROOT ?? fileURLToPath(new URL('../node_modules', import.meta.url))
const modulePath = (name: string) => pathToFileURL(join(runtimeRoot, '@deepseek-ai', name, 'lib', 'index.js')).href
const runtimeVersion = JSON.parse(readFileSync(join(runtimeRoot, '@deepseek-ai', 'dsh-tools', 'package.json'), 'utf8')).version

const load = async () => {
  const { Context } = await import(/* @vite-ignore */ modulePath('cordis')) as { Context: typeof ContextType }
  const { ToolRuntime } = await import(/* @vite-ignore */ modulePath('dsh-tools')) as { ToolRuntime: typeof RuntimeType }
  return { Context, ToolRuntime }
}

const setupTools = async (ctx: ContextType, ToolRuntime: typeof RuntimeType) => {
  if (!ctx.tools) new ToolRuntime(ctx)
  const anyTools = ctx.tools as unknown as { setExecutor?: (executor: unknown) => void }
  if (typeof anyTools?.setExecutor === 'function') {
    const pipelinePath = pathToFileURL(join(runtimeRoot, '@deepseek-ai', 'dsh-tools', 'lib', 'pipeline.js')).href
    const toolsPath = pathToFileURL(join(runtimeRoot, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js')).href
    const { ToolExecutionPipeline, executeToolBatch } = await import(/* @vite-ignore */ pipelinePath)
    const { projectToolSchema } = await import(/* @vite-ignore */ toolsPath) as { projectToolSchema: (d: unknown, f: boolean) => unknown }
    const pipeline = new ToolExecutionPipeline(ctx)
    anyTools.setExecutor({
      describe: (tools: unknown[]) => ({ schemas: tools.map(t => projectToolSchema(t, false)) }),
      execute: async (input: { calls?: unknown[]; name?: string; callId?: string; arguments?: unknown }) => {
        const isSingleCall = !input.calls && input.name
        const batchInput = isSingleCall
          ? { ...input, calls: [{ id: input.callId, name: input.name, arguments: JSON.stringify(input.arguments ?? {}) }] }
          : input
        const outcome = await executeToolBatch(batchInput, pipeline, () => 10)
        return isSingleCall ? (outcome.results[0]?.result ?? outcome) : outcome
      },
    })
  }
}

interface Probe {
  name: string
  args?: unknown
  /** `child` 在子代理运行中执行；`main` 在旁问结束后以主任务身份执行。 */
  when: 'child' | 'main'
}

interface CallResult {
  name: string
  when: Probe['when']
  isError: boolean | undefined
  content: string
}

interface Harness {
  ctx: ContextType
  execute: ReturnType<typeof vi.fn>
  prompts: string[]
  calls: CallResult[]
  ask(question: string): Promise<{ kind: string; text?: string } | undefined>
  dispose(): Promise<void>
}

const harness = async (config: unknown, probes: readonly Probe[]): Promise<Harness> => {
  const { Context, ToolRuntime } = await load()
  const ctx = new Context()
  ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
  await setupTools(ctx, ToolRuntime)
  const commands = new Map<string, CommandDefinition>()
  ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
  const execute = vi.fn(async () => 'executed')
  ctx.tools.register({
    name: 'pele_draw',
    description: '测试用图表工具',
    parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] },
    execute,
  })
  const prompts: string[] = []
  const calls: CallResult[] = []
  const run = async (probe: Probe, agent?: object) => {
    const outcome = await ctx.tools.execute({
      name: probe.name,
      callId: `call-${calls.length + 1}` as never,
      arguments: (probe.args ?? {}) as never,
      ...(agent === undefined ? {} : { agent: agent as never }),
      signal: new AbortController().signal,
    })
    calls.push({ name: probe.name, when: probe.when, isError: outcome.isError, content: JSON.stringify(outcome.content) })
  }
  ctx.provide('subagents', {
    getProvider: () => ({ inheritsParentContext: true, capabilities: { agentOptions: true } }),
    startActivation: async (spec: { childId?: string; request: { prompt: readonly { type: string; text: string }[] } }) => {
      prompts.push(spec.request.prompt.map(block => block.text).join(''))
      // 子代理运行中：此刻 childId 已被预登记，闸门会介入。
      for (const probe of probes) {
        if (probe.when === 'child') await run(probe, { id: spec.childId })
      }
      return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '回答' }] }), dispose: async () => {} }
    },
  })
  const plugin = config === undefined ? ctx.plugin(apply) : ctx.plugin(apply, config as never)
  await plugin.await()
  let requestSeq = 0
  return {
    ctx,
    execute,
    prompts,
    calls,
    ask: async (question: string) => {
      const answer = await commands.get(RUN_COMMAND)!.handler({
        agent: { session: { header: { id: 'main' } }, options: { maxTokens: 4096 } },
        // id 必须匹配 /^[a-zA-Z0-9-]{8,80}$/（见 parseRequest），中文只能出现在 question 里。
        rawInput: JSON.stringify({ id: `req-${String(requestSeq++).padStart(8, '0')}`, question }),
        signal: new AbortController().signal,
      } as never) as { kind: string; text?: string } | undefined
      // 旁问已结束、id 已释放：此时以主任务身份调用同名工具。
      for (const probe of probes) {
        if (probe.when === 'main') await run(probe)
      }
      return answer
    },
    dispose: async () => { await plugin.dispose(); await ctx.fiber.dispose() },
  }
}

const childProbe: Probe = { name: 'pele_draw', when: 'child' }

describe(`DSH ${runtimeVersion} 旁问设置项接线`, () => {
  it('未配置时保持 1.1.1 行为：pele_draw 被拒、提示词用内置文案', async () => {
    const h = await harness(undefined, [childProbe])
    expect(await h.ask('未配置')).toMatchObject({ kind: 'success' })
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.isError).toBe(true)
    expect(h.calls[0]!.content).toContain('BTW 仅允许文字回答，禁止执行任何工具。')
    expect(h.execute).not.toHaveBeenCalled()
    expect(h.prompts[0]).toContain('除 send_message 之外任何工具调用都会被拒绝')
    expect(h.prompts[0]).not.toContain('白名单')
    await h.dispose()
  })

  it('配置白名单后放行该工具，并在提示词与拒绝文案里点名它', async () => {
    const h = await harness({ allowedTools: ['pele_draw'], promptPrefix: '' }, [childProbe])
    expect(await h.ask('放行图表')).toMatchObject({ kind: 'success' })
    expect(h.calls[0]!.isError).not.toBe(true)
    expect(h.execute).toHaveBeenCalledOnce()
    // 权限说明始终追加，配置不能让「能调什么」的边界从提示词里消失。
    expect(h.prompts[0]).toContain('pele_draw')
    expect(h.prompts[0]).toContain('额外放行这些工具')
    expect(h.prompts[0]).toContain('除 send_message 之外任何工具调用都会被拒绝')
    await h.dispose()
  })

  it('自定义提示词替换内置前缀，工具权限句仍由配置追加', async () => {
    const h = await harness({ allowedTools: ['pele_draw'], promptPrefix: '只给结论与依据。' }, [childProbe])
    expect(await h.ask('自定义前缀')).toMatchObject({ kind: 'success' })
    expect(h.prompts[0]!.startsWith('只给结论与依据。')).toBe(true)
    expect(h.prompts[0]).not.toContain('除 send_message 之外任何工具调用都会被拒绝')
    expect(h.prompts[0]).toContain('pele_draw')
    expect(h.prompts[0]).toContain('自定义前缀')
    await h.dispose()
  })

  it('volatile 形状（Cosmokit 引用）的配置同样生效，面板写入的就是这种形状', async () => {
    const volatile = <T>(value: T) => ({ get: () => value })
    const h = await harness({ allowedTools: volatile(['pele_draw']), promptPrefix: volatile('') }, [childProbe])
    expect(await h.ask('引用形状')).toMatchObject({ kind: 'success' })
    expect(h.calls[0]!.isError).not.toBe(true)
    expect(h.execute).toHaveBeenCalledOnce()
    await h.dispose()
  })

  it('白名单里写错名字不会放宽任何东西，拒绝文案如实列出配置内容', async () => {
    const h = await harness({ allowedTools: ['no_such_tool'] }, [childProbe])
    expect(await h.ask('写错名字')).toMatchObject({ kind: 'success' })
    expect(h.calls[0]!.isError).toBe(true)
    expect(h.calls[0]!.content).toContain('no_such_tool')
    expect(h.execute).not.toHaveBeenCalled()
    await h.dispose()
  })

  it('主任务的同名工具不受白名单影响，配置只作用于旁问代理', async () => {
    const h = await harness({ allowedTools: [] }, [{ name: 'pele_draw', when: 'main' }])
    expect(await h.ask('主任务')).toMatchObject({ kind: 'success' })
    expect(h.calls[0]!.isError).not.toBe(true)
    expect(h.execute).toHaveBeenCalledOnce()
    await h.dispose()
  })
})
