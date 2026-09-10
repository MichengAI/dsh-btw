import type { Context as ContextType } from '@deepseek-ai/cordis'
import type { CommandRuntime as CommandRuntimeType } from '@deepseek-ai/dsh-commands'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { expect, it, vi } from 'vitest'
import { apply } from '../src/index'
import { CLOSE_COMMAND, RUN_COMMAND } from '../src/shared'

const runtimeRoot = process.env.DSH_RUNTIME_ROOT ?? fileURLToPath(new URL('../node_modules', import.meta.url))
const runtimeRoots = [...new Set([runtimeRoot, ...(process.env.DSH_DESKTOP_RUNTIME_ROOT ? [process.env.DSH_DESKTOP_RUNTIME_ROOT] : [])])]

it.each(runtimeRoots)('真实 RPC 目录隐藏内部命令且执行与卸载正常：%s', async root => {
  const version = JSON.parse(readFileSync(join(root, '@deepseek-ai', 'dsh-commands', 'package.json'), 'utf8')).version as string
  const attachments = version.startsWith('0.1.5') ? { submittedAttachments: [] } : { images: [] }
  const modulePath = (name: string, file = 'index.js') => pathToFileURL(join(root, '@deepseek-ai', name, 'lib', file)).href
  const { Context } = await import(/* @vite-ignore */ modulePath('cordis')) as { Context: typeof ContextType }
  const { CommandRuntime } = await import(/* @vite-ignore */ modulePath('dsh-commands')) as { CommandRuntime: typeof CommandRuntimeType }
  const { TypertRegistry } = await import(/* @vite-ignore */ modulePath('dsh-typert-registry'))
  const { TypertGatewayService } = await import(/* @vite-ignore */ modulePath('dsh-api-gateway'))
  const { TYPERT } = await import(/* @vite-ignore */ modulePath('dsh-commands', 'typert.host.js'))
  const ctx = new Context()
  new CommandRuntime(ctx)
  const registry = new TypertRegistry(ctx)
  registry.register(TYPERT)
  const gateway = new TypertGatewayService(ctx, { websocketHeartbeatIntervalMs: 2000 })
  ctx.provide('tools', { guard: () => () => {} })
  ctx.provide('subagents', {
    getProvider: () => ({ inheritsParentContext: true, capabilities: { toolFilter: true, persona: true } }),
    start: async () => ({ result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '回答' }] }), dispose: async () => {} }),
  })
  const agent = { session: { header: { id: 'main' }, append: vi.fn() } } as unknown as Agent
  registry.lookups.register('agent', {
    parameter: 'agent', wire: 'agentId',
    hostTypeSymbol: '@deepseek-ai/dsh-agent#Agent',
    wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    resolve: (id: string) => id === 'main' ? agent : undefined,
  })
  const listRemote = () => gateway.invoke({ namespace: 'commands', method: 'list', args: { agentId: 'main' } })
  ctx.commands.register({ name: 'other', description: '其他命令', handler: () => ({ kind: 'success', text: 'other' }) })
  const plugin = ctx.plugin(apply)
  try {
    await plugin.await()
    expect(ctx.commands.list(agent).map(item => item.name)).toEqual(['other'])
    expect(await listRemote()).toEqual([{ name: 'other', description: '其他命令' }])
    for (const line of [`/${RUN_COMMAND} ${JSON.stringify({ id: 'request01', question: '你好' })}`, `/${CLOSE_COMMAND} request01`]) {
      expect((await gateway.invoke({ namespace: 'commands', method: 'execute', args: { agentId: 'main', line, ...attachments }, signal: new AbortController().signal }))?.result.kind).toBe('success')
    }
    await plugin.dispose()
    ctx.commands.register({ name: RUN_COMMAND, description: '恢复检查', handler: () => ({ kind: 'success' }) })
    expect(ctx.commands.list(agent).map(item => item.name)).toEqual([RUN_COMMAND, 'other'])
    expect(await listRemote()).toEqual([{ name: RUN_COMMAND, description: '恢复检查' }, { name: 'other', description: '其他命令' }])
  } finally { await ctx.fiber.dispose() }
})
