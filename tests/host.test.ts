import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { Context as ContextType } from '@deepseek-ai/cordis'
import type { ToolRuntime as RuntimeType } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { apply } from '../src/index'
import { RUN_COMMAND } from '../src/shared'
import { createAnswerOnlyGuard } from '../src/server/tool-guard'

// 复用已安装宿主的依赖图，只装配内存服务，不读取 profile 配置或模型凭据。
const runtimeRoot = process.env.DSH_RUNTIME_ROOT ?? join(homedir(), '.dsh', 'profiles', 'node_modules')
const modulePath = (name: string) => pathToFileURL(join(runtimeRoot, '@deepseek-ai', name, 'lib', 'index.js')).href
const available = existsSync(join(runtimeRoot, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'))

describe.skipIf(!available)('DSH 0.1.2-rc.1 真实运行时', () => {
  const load = async () => {
    const { Context } = await import(/* @vite-ignore */ modulePath('cordis')) as { Context: typeof ContextType }
    const { ToolRuntime } = await import(/* @vite-ignore */ modulePath('dsh-tools')) as { ToolRuntime: typeof RuntimeType }
    const { createScope } = await import(/* @vite-ignore */ modulePath('dsh-scope')) as {
      createScope(ctx: ContextType, key: object): { ctx: ContextType; dispose(): Promise<void> }
    }
    return { Context, ToolRuntime, createScope }
  }

  it('空白名单之外的自有工具与 run_code 也被拒绝，主任务工具可执行', async () => {
    const { Context, ToolRuntime, createScope } = await load()
    const ctx = new Context()
    ctx.provide('systemPrompt', { tools: () => () => {}, section: () => () => {}, getSectionOrder: () => 0 })
    new ToolRuntime(ctx)
    const child = { session: { snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label: 'owned' } }] } } as unknown as Agent
    const scope = createScope(ctx, child)
    const body = vi.fn(async () => 'executed')
    ctx.tools.register({ name: 'normal', description: '测试工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    scope.ctx.tools.restrict({ allow: [] })
    scope.ctx.tools.register({ name: 'child_local', description: '子作用域工具', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute: body })
    scope.ctx.tools.presentAs('both')
    ctx.tools.guard(createAnswerOnlyGuard(new Set(['owned'])))
    expect(ctx.tools.get('normal', child)).toBeUndefined()
    expect(ctx.tools.get('child_local', child)).toBeDefined()
    expect(ctx.tools.get('run_code', child)).toBeDefined()
    for (const name of ['child_local', 'run_code']) {
      const result = await ctx.tools.execute({ name, callId: 'test' as never, arguments: {}, agent: child, signal: new AbortController().signal })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: 'text', text: 'Error: BTW 仅允许文字回答，禁止执行任何工具。' }])
    }
    expect(body).not.toHaveBeenCalled()
    const result = await ctx.tools.execute({ name: 'normal', callId: 'main' as never, arguments: {}, signal: new AbortController().signal })
    expect(result.isError).not.toBe(true)
    expect(body).toHaveBeenCalledOnce()
    await scope.dispose()
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
      getProvider: () => ({ inheritsParentContext: true, capabilities: { toolFilter: true, persona: true } }),
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
})
