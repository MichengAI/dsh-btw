import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context as ContextType } from '@deepseek-ai/cordis'
import type { ToolRuntime as RuntimeType } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { apply } from '../src/index'
import { RUN_COMMAND } from '../src/shared'
import { SIDE_MAX_OUTPUT_TOKENS } from '../src/limits'
import { createAnswerOnlyGuard } from '../src/server/tool-guard'

// 默认验证锁文件中的宿主版本；允许显式指定旧版依赖图做兼容回归。
const runtimeRoot = process.env.DSH_RUNTIME_ROOT ?? fileURLToPath(new URL('../node_modules', import.meta.url))
const modulePath = (name: string) => pathToFileURL(join(runtimeRoot, '@deepseek-ai', name, 'lib', 'index.js')).href
const runtimeVersion = JSON.parse(readFileSync(join(runtimeRoot, '@deepseek-ai', 'dsh-tools', 'package.json'), 'utf8')).version
afterEach(() => { vi.useRealTimers() })

describe(`DSH ${runtimeVersion} 真实运行时`, () => {
  const load = async () => {
    const { Context } = await import(/* @vite-ignore */ modulePath('cordis')) as { Context: typeof ContextType }
    const { ToolRuntime } = await import(/* @vite-ignore */ modulePath('dsh-tools')) as { ToolRuntime: typeof RuntimeType }
    const { createScope } = await import(/* @vite-ignore */ modulePath('dsh-scope')) as {
      createScope(ctx: ContextType, key: object): { ctx: ContextType; dispose(): Promise<void> }
    }
    return { Context, ToolRuntime, createScope }
  }

  it('根 fiber 拒绝 effect 时仍能激活并注册 btw', async () => {
    const { Context, ToolRuntime } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const commands = new Map<string, CommandDefinition>()
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    ctx.provide('subagents', { getProvider: () => undefined })
    const fiber = ctx.root.fiber as { effect(execute: () => unknown, label?: string): unknown }
    const rootEffect = fiber.effect.bind(ctx.root.fiber)
    fiber.effect = (execute, label) => {
      if (label === 'tools.guard()') throw new Error('dsh-tui: root.effect is unavailable from a plugin activation')
      return rootEffect(execute, label)
    }
    const plugin = ctx.plugin(apply)
    try {
      await plugin.await()
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }
    expect(commands.has('btw')).toBe(true)
    await plugin.dispose()
    await ctx.fiber.dispose()
  })

  it('空白名单之外的自有工具与 run_code 也被拒绝，主任务工具可执行', async () => {
    const { Context, ToolRuntime, createScope } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const body = vi.fn(async () => 'executed')
    ctx.tools.register({ name: 'normal', description: '测试工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    const protection = createAnswerOnlyGuard(new Set(['owned']))
    ctx.tools.guard(protection)
    // alpha.2+ 移除 presentAs('both')：native 覆盖子作用域自有工具；ptc 覆盖宿主 run_code。
    const childNative = { session: {} } as unknown as Agent
    const scopeNative = createScope(ctx, childNative)
    scopeNative.ctx.tools.register({ name: 'child_local', description: '子作用域工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    scopeNative.ctx.tools.presentAs('native')
    protection.own(childNative)
    expect(ctx.tools.get('normal', childNative)).toBeDefined()
    expect(ctx.tools.get('child_local', childNative)).toBeDefined()
    const blockedLocal = await ctx.tools.execute({ name: 'child_local', callId: 'test-local' as never, arguments: {}, agent: childNative, signal: new AbortController().signal })
    expect(blockedLocal.isError).toBe(true)
    expect(JSON.stringify(blockedLocal.content)).toContain('BTW 仅允许文字回答，禁止执行任何工具。')

    const childPtc = { session: {} } as unknown as Agent
    const scopePtc = createScope(ctx, childPtc)
    scopePtc.ctx.tools.presentAs('ptc')
    protection.own(childPtc)
    expect(ctx.tools.get('run_code', childPtc)).toBeDefined()
    const blockedRun = await ctx.tools.execute({ name: 'run_code', callId: 'test-run' as never, arguments: { description: 'x', code: '1' }, agent: childPtc, signal: new AbortController().signal })
    expect(blockedRun.isError).toBe(true)
    expect(JSON.stringify(blockedRun.content)).toContain('BTW 仅允许文字回答，禁止执行任何工具。')
    expect(body).not.toHaveBeenCalled()

    const result = await ctx.tools.execute({ name: 'normal', callId: 'main' as never, arguments: {}, signal: new AbortController().signal })
    expect(result.isError).not.toBe(true)
    expect(body).toHaveBeenCalledOnce()
    await scopeNative.dispose()
    await scopePtc.dispose()
    await ctx.fiber.dispose()
  })

  it('根上下文 session/event 能认领尚未返回 localAgent 的子代理', async () => {
    const { Context, ToolRuntime, createScope } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const commands = new Map<string, CommandDefinition>()
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    const child = { session: { snapshotEvents: () => { throw new Error('生产路径不应再读 snapshotEvents') } } } as unknown as Agent
    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { toolFilter: true, persona: true } }),
      start: async (_provider: string, options: { label: string }) => {
        ctx.emit('session/event', child.session as never, { type: 'subagent/descriptor', data: { label: options.label } } as never)
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'ok' }] }), dispose: async () => {} }
      },
    })
    const plugin = ctx.plugin(apply)
    await plugin.await()
    const scope = createScope(ctx, child)
    const body = vi.fn(async () => 'executed')
    scope.ctx.tools.register({ name: 'child_local', description: '子作用域工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    await commands.get(RUN_COMMAND)!.handler({ agent: { session: { header: { id: 'main' } } }, rawInput: JSON.stringify({ id: 'request-evt', question: '问题' }), signal: new AbortController().signal } as never)
    const blocked = await ctx.tools.execute({ name: 'child_local', callId: 'event' as never, arguments: {}, agent: child, signal: new AbortController().signal })
    expect(blocked.isError).toBe(true)
    expect(body).not.toHaveBeenCalled()
    await plugin.dispose()
    await scope.dispose()
    await ctx.fiber.dispose()
  })

  it('startActivation 路径收紧旁问输出预算，取 min 避免抬高小预算路由', async () => {
    const { Context, ToolRuntime } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const commands = new Map<string, CommandDefinition>()
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    const dispose = vi.fn(async () => {})
    const startActivation = vi.fn(async (spec: {
      provider: string
      request: { parent: unknown; agentOptions?: { maxTokens?: number }; prompt: readonly { type: string; text: string }[] }
    }) => ({
      result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '旁问答案' }] }),
      dispose,
    }))
    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true } }),
      startActivation,
    })

    const plugin = ctx.plugin(apply)
    await plugin.await()
    // 1. 父任务为小预算路由 (4096) 时，不能抬高到 32000
    const outcome1 = await commands.get(RUN_COMMAND)!.handler({
      agent: { session: { header: { id: 'main' } }, options: { maxTokens: 4096 } },
      rawInput: JSON.stringify({ id: 'small-budget-req', question: '小预算' }),
      signal: new AbortController().signal,
    } as never)
    expect(outcome1).toEqual({ kind: 'success', text: '旁问答案' })
    const spec0 = startActivation.mock.calls[0]![0]
    expect(spec0.provider).toBe('fork')
    expect(spec0.request.parent).toBeDefined()
    expect(spec0.request.prompt).toEqual([{ type: 'text', text: expect.stringContaining('小预算') }])
    expect(spec0.request.agentOptions).toEqual({ maxTokens: 4096 })

    // 2. 父任务为大上下文 (256000) 时，收紧到 32000
    await commands.get(RUN_COMMAND)!.handler({
      agent: { session: { header: { id: 'main' } }, options: { maxTokens: 256_000 } },
      rawInput: JSON.stringify({ id: 'large-budget-req', question: '大预算' }),
      signal: new AbortController().signal,
    } as never)
    expect(startActivation.mock.calls[1]![0].request.agentOptions).toEqual({ maxTokens: SIDE_MAX_OUTPUT_TOKENS })

    // 3. 父任务未显式配置 maxTokens 时，缺省使用 32000
    await commands.get(RUN_COMMAND)!.handler({
      agent: { session: { header: { id: 'main' } } },
      rawInput: JSON.stringify({ id: 'default-budget-req', question: '缺省预算' }),
      signal: new AbortController().signal,
    } as never)
    expect(startActivation.mock.calls[2]![0].request.agentOptions).toEqual({ maxTokens: SIDE_MAX_OUTPUT_TOKENS })

    await plugin.dispose()
    await ctx.fiber.dispose()
  })

  it('subagents.start 不改系统提示与工具定义，并传递 agentOptions 预算限制', async () => {
    const { Context, ToolRuntime, createScope } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const commands = new Map<string, CommandDefinition>()
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })

    const child = { session: {} } as Agent & { ctx?: ContextType }
    let scope: { ctx: ContextType; dispose(): Promise<void> }
    const dispose = vi.fn(async () => {})
    const startLegacy = vi.fn(async (_provider: string, options: {
      parent: Agent
      label: string
      agentOptions?: { maxTokens?: number }
      toolFilter?: unknown
      persona?: unknown
      prompt: readonly { type: string; text: string }[]
    }) => {
      scope = createScope(ctx, child)
      child.ctx = scope.ctx
      // persona / toolFilter 会改写请求前缀，使旁问无法复用主会话的 prompt cache
      expect(options.toolFilter).toBeUndefined()
      expect(options.persona).toBeUndefined()
      expect(options.agentOptions).toEqual({ maxTokens: 4096 })
      return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'start 回退答案' }] }), localAgent: child, dispose }
    })

    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { toolFilter: true, persona: true, agentOptions: true } }),
      start: startLegacy,
    })

    const plugin = ctx.plugin(apply)
    await plugin.await()

    const outcome = await commands.get(RUN_COMMAND)!.handler({
      agent: { session: { header: { id: 'main' } }, options: { maxTokens: 4096 } },
      rawInput: JSON.stringify({ id: 'legacy-req', question: '旧版问题' }),
      signal: new AbortController().signal,
    } as never)

    expect(outcome).toEqual({ kind: 'success', text: 'start 回退答案' })
    expect(startLegacy).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce() // 正常完成在 SideJobs execute 结束时调用 cleanup 释放

    // start 回退返回的 localAgent 也要纳入工具拦截
    const currentScope = scope!
    currentScope.ctx.tools.register({ name: 'legacy_tool', description: '测试工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: v => [{ type: 'text', text: String(v) }] }, execute: vi.fn() })
    const blocked = await ctx.tools.execute({ name: 'legacy_tool', callId: 'test-call' as never, arguments: {}, agent: child, signal: new AbortController().signal })
    expect(blocked.isError).toBe(true)
    expect(JSON.stringify(blocked.content)).toContain('BTW 仅允许文字回答，禁止执行任何工具。')

    await plugin.dispose()
    if (scope!) await scope.dispose()
    await ctx.fiber.dispose()
  })

  it('插件卸载期间保护持续到子代理清理完成', async () => {
    const { Context } = await load()
    const ctx = new Context()
    const commands = new Map<string, CommandDefinition>()
    let protectedNow = false
    let finishCleanup!: () => void
    let cleanupStarted = false
    ctx.provide('tools', { guard: () => ctx.effect(() => { protectedNow = true; return () => { protectedNow = false } }) })
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true } }),
      start: async () => ({ result: new Promise(() => {}), dispose: () => { cleanupStarted = true; return new Promise<void>(resolve => { finishCleanup = resolve }) } }),
    })
    const plugin = ctx.plugin(apply)
    await plugin.await()
    const answer = commands.get(RUN_COMMAND)!.handler({ agent: { session: { header: { id: 'main' } } }, rawInput: JSON.stringify({ id: 'request-123', question: '问题' }), signal: new AbortController().signal } as never)
    await Promise.resolve()
    const unload = plugin.dispose()
    await vi.waitFor(() => expect(cleanupStarted).toBe(true))
    expect(protectedNow).toBe(true)
    finishCleanup()
    await unload
    await answer
    expect(protectedNow).toBe(false)
    await ctx.fiber.dispose()
  })

  it('卸载清理挂起时按时退出，真实工具保护延续到迟到清理成功', async () => {
    const { Context, ToolRuntime, createScope } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const commands = new Map<string, CommandDefinition>()
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    let finishCleanup!: () => void
    const cleanup = new Promise<void>(resolve => { finishCleanup = resolve })
    const dispose = vi.fn(() => cleanup)
    const child = { session: {} } as Agent & { ctx?: ContextType }
    let scope: { ctx: ContextType; dispose(): Promise<void> }
    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true } }),
      start: async () => {
        scope = createScope(ctx, child)
        child.ctx = scope.ctx
        return { result: new Promise(() => {}), localAgent: child, dispose }
      },
    })
    const plugin = ctx.plugin(apply)
    await plugin.await()
    vi.useFakeTimers()
    const answer = commands.get(RUN_COMMAND)!.handler({ agent: { session: { header: { id: 'main' } } }, rawInput: JSON.stringify({ id: 'request-123', question: '问题' }), signal: new AbortController().signal } as never)
    await vi.advanceTimersByTimeAsync(0)
    const body = vi.fn(async () => 'executed')
    scope!.ctx.tools.register({ name: 'orphan_tool', description: '未释放子代理的工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    const unload = plugin.dispose()
    const finished = vi.fn()
    void unload.then(finished)
    await vi.advanceTimersByTimeAsync(5_001)
    expect(finished).toHaveBeenCalledTimes(1)
    expect(commands.has(RUN_COMMAND)).toBe(false)
    expect((await answer)?.kind).toBe('error')
    expect(dispose).toHaveBeenCalledTimes(1)
    const blocked = await ctx.tools.execute({ name: 'orphan_tool', callId: 'orphan' as never, arguments: {}, agent: child, signal: new AbortController().signal })
    expect(blocked.isError).toBe(true)
    expect(body).not.toHaveBeenCalled()
    finishCleanup()
    await vi.advanceTimersByTimeAsync(0)
    const released = await ctx.tools.execute({ name: 'orphan_tool', callId: 'released' as never, arguments: {}, agent: child, signal: new AbortController().signal })
    expect(released.isError).not.toBe(true)
    expect(body).toHaveBeenCalledTimes(1)
    await scope!.dispose()
    await ctx.fiber.dispose()
  })

  it('卸载时启动仍挂起，迟到句柄被清理且注销保护', async () => {
    const { Context } = await load()
    const ctx = new Context()
    const commands = new Map<string, CommandDefinition>()
    let protectedNow = false
    let finishStart!: (run: { result: Promise<unknown>; localAgent?: object; dispose: () => Promise<void> }) => void
    ctx.provide('tools', { guard: () => ctx.effect(() => { protectedNow = true; return () => { protectedNow = false } }) })
    ctx.provide('commands', { register: (command: CommandDefinition) => { commands.set(command.name, command); return () => { commands.delete(command.name) } } })
    ctx.provide('subagents', {
      getProvider: () => ({ inheritsParentContext: true, capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true } }),
      start: () => new Promise(resolve => { finishStart = resolve as typeof finishStart }),
    })
    const plugin = ctx.plugin(apply)
    await plugin.await()
    vi.useFakeTimers()
    const answer = commands.get(RUN_COMMAND)!.handler({ agent: { session: { header: { id: 'main' } } }, rawInput: JSON.stringify({ id: 'request-123', question: '问题' }), signal: new AbortController().signal } as never)
    const unload = plugin.dispose()
    await vi.advanceTimersByTimeAsync(5_001)
    await expect(unload).resolves.toBeUndefined()
    expect(protectedNow).toBe(true)
    const dispose = vi.fn(async () => {})
    finishStart({ result: new Promise(() => {}), dispose })
    await vi.advanceTimersByTimeAsync(0)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(protectedNow).toBe(false)
    expect((await answer)?.kind).toBe('error')
    await ctx.fiber.dispose()
  })
})
