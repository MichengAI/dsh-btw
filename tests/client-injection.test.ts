import { Context, Service } from '@deepseek-ai/cordis'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { afterEach, expect, it, vi } from 'vitest'
import * as clientPlugin from '../src/client/index'
import { hostLocaleRuntime } from './host-client-fixtures'

afterEach(() => vi.unstubAllGlobals())

it('真实 Cordis 依赖检查下可通过 remote.commands 发送旁问', async () => {
  const ctx = new Context()
  const denied: string[] = []
  const execute = vi.fn(async (_session: string, _line: string, _images: unknown[], _signal?: AbortSignal) => ({ ok: true, value: { result: { kind: 'success', text: '回答' } } }))
  let source!: InputTriggerSource
  const activeSources = new Set<InputTriggerSource>()
  // 模拟传输端点，但由真实 Cordis 检查命名空间服务的注入权限。
  class Remote extends Service {
    constructor(context: Context) { super(context, 'remote') }
    get commands() {
      try { return (this.ctx as Context & { 'remote.commands': { execute: typeof execute } })['remote.commands'] }
      catch (error) { denied.push((error as Error).message); throw error }
    }
  }
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } })
  vi.stubGlobal('document', { createElement: () => ({ dataset: {}, remove: () => {} }), head: { append: () => {} } })
  ctx.provide('slots', { inject: () => () => {} })
  ctx.provide('inputTriggers', { registerSource: (value: InputTriggerSource) => { source = value; activeSources.add(value); return () => { activeSources.delete(value) } } })
  const LocaleRuntime = hostLocaleRuntime()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const provider = ctx.plugin((scope: Context) => { scope.provide('remote.commands', { execute }) })
  await provider.await()
  new Remote(ctx)
  const plugin = ctx.plugin(clientPlugin)
  try {
    await plugin.await()
    expect(source.name).toBe('Side Questions')
    const picked = source.matchSpace!({ sessionId: 'test-session' } as never, '/btw')
    if (!picked || typeof picked !== 'object' || !('claim' in picked)) throw new Error('未取得旁问输入处理器')
    await picked.claim.submit('你好', ctx, [])
    await new Promise(resolve => setImmediate(resolve))
    expect(denied).toEqual([])
    expect(execute).toHaveBeenCalledWith('test-session', expect.stringContaining('/btw-run '), [], expect.any(AbortSignal))
    expect(execute.mock.calls[0]?.[1]).toContain('"locale":"en"')
    expect(await source.candidates({} as never, { query: 'btw', signal: new AbortController().signal } as never)).toEqual([
      { name: 'btw', description: 'Ask a side question using the current context', hint: 'Side question' },
    ])
    locale.setLocale('zh')
    expect(source.name).toBe('旁问')
    expect(activeSources.size).toBe(1)
    const next = source.matchSpace!({ sessionId: 'test-session' } as never, '/btw')
    expect(next && typeof next === 'object' && 'claim' in next && next.claim.hint).toBe('旁问内容')
  } finally { await plugin.dispose(); await ctx.fiber.dispose() }
})
