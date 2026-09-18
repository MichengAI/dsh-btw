import { Context, Service } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInThisContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import * as clientPlugin from '../src/client/index'
import { hostLocaleRuntime } from './host-client-fixtures'

afterEach(() => vi.unstubAllGlobals())

it('真实 Cordis 依赖检查下可通过官方指令目录发送旁问', async () => {
  const ctx = new Context()
  const denied: string[] = []
  const execute = vi.fn(async (_session: string, _line: string, _images: unknown[], _signal?: AbortSignal) => ({ ok: true, value: { result: { kind: 'success', text: '回答' } } }))
  const commandUi = {
    candidates: async () => ([
      { name: 'compact', description: '压缩以上对话内容' },
      { name: 'btw', description: '旧描述' },
    ]),
    dispatch: (pick: { candidate?: { name?: string }; session?: unknown }) => pick as unknown,
    matchSpace: (_session: unknown, token: string) => token as unknown,
    matchEnter: async (_session: unknown, line: string, _signal?: AbortSignal, _envelope?: { attachments?: number }) => line as unknown,
    execute: async (_session: unknown, line: string, _attachments?: unknown) => ({ kind: 'host', line }),
  }
  let implementation = clientPlugin
  const loader = { load: (entry: { factory: (require: ReturnType<typeof createRequire>) => typeof clientPlugin }) => {
    implementation = entry.factory(createRequire(import.meta.url))
  } }
  class Remote extends Service {
    constructor(context: Context) { super(context, 'remote') }
    get commands() {
      try { return (this.ctx as Context & { 'remote.commands': { execute: typeof execute } })['remote.commands'] }
      catch (error) { denied.push((error as Error).message); throw error }
    }
  }
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} }, __ModuleLoader__: loader })
  vi.stubGlobal('document', { createElement: () => ({ dataset: {}, remove: () => {} }), head: { append: () => {} } })
  ctx.provide('sessions', { scope: () => ctx })
  ctx.provide('conversation', { input: { for: () => ({}) } })
  ctx.provide('slots', { inject: () => () => {} })
  ctx.provide('commandUi', commandUi)
  const LocaleRuntime = hostLocaleRuntime()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const provider = ctx.plugin((scope: Context) => { scope.provide('remote.commands', { execute }) })
  await provider.await()
  new Remote(ctx)
  if (process.env.DSH_BTW_BUNDLE === '1') runInThisContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  const plugin = ctx.plugin(implementation)
  try {
    await plugin.await()
    const picked = commandUi.dispatch({ candidate: { name: 'btw' }, session: { sessionId: 'test-session' } })
    if (!picked || typeof picked !== 'object' || !('claim' in picked) || !picked.claim || typeof picked.claim !== 'object' || !('submit' in picked.claim)) throw new Error('未取得旁问输入处理器')
    const submit = picked.claim.submit as (args: string, actx: unknown, attachments: unknown[]) => Promise<{ kind: string }>
    await expect(submit('你好', ctx, [{ type: 'image' }])).resolves.toMatchObject({ kind: 'error' })
    expect(execute).not.toHaveBeenCalled()
    await submit('你好', ctx, [])
    await new Promise(resolve => setImmediate(resolve))
    expect(denied).toEqual([])
    expect(execute).toHaveBeenCalledWith('test-session', expect.stringContaining('/btw-run '), [], expect.any(AbortSignal))
    expect(execute.mock.calls[0]?.[1]).toContain('"locale":"en"')
    expect(commandUi.matchSpace({ sessionId: 'test-session' }, '/btw')).toHaveProperty('claim')
    await expect(commandUi.matchEnter({ sessionId: 'test-session' }, '/btw 你好', new AbortController().signal, { attachments: 1 })).rejects.toThrow()
    await expect(commandUi.execute({ sessionId: 'test-session' }, '/btw 你好')).resolves.toMatchObject({ kind: 'success' })
    const english = await commandUi.candidates() as { name: string; icon?: unknown }[]
    expect(english[0]).toEqual({ name: 'compact', description: '压缩以上对话内容' })
    expect(english[1]).toMatchObject({
      name: 'btw',
      label: 'Side question',
      description: 'Answer from current context without running tools',
      hint: 'Side question',
    })
    expect(english[1]?.icon).toEqual(expect.any(Function))
    locale.setLocale('zh')
    const chinese = await commandUi.candidates()
    expect(chinese[1]).toMatchObject({
      name: 'btw',
      label: '旁问',
      description: '根据当前上下文回答，不执行工具',
      hint: '旁问内容',
    })
  } finally { await plugin.dispose(); await ctx.fiber.dispose() }
})
