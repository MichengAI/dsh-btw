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
  const injectedStyles: { dataset: Record<string, string>; textContent?: string; removed?: boolean }[] = []
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} }, __ModuleLoader__: loader })
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      const el: { dataset: Record<string, string>; textContent: string; removed?: boolean; remove: () => void } = {
        dataset: {} as Record<string, string>,
        textContent: '',
        remove: () => { el.removed = true },
      }
      if (tag === 'style') injectedStyles.push(el)
      return el
    },
    head: { append: () => {} },
  })
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
    expect(injectedStyles).toHaveLength(1)
    expect(injectedStyles[0]?.dataset).toMatchObject({
      plugin: '@michengai/dsh-btw',
      pluginCss: '@michengai/dsh-btw/client.css',
      michengaiBtw: '',
    })
  } finally {
    await plugin.dispose()
    await ctx.fiber.dispose()
    expect(injectedStyles[0]?.removed).toBe(true)
  }
})

it('DSH 0.2.0-rc.2 claimStyles 不会误认领或因其他插件卸载而摘除 BTW 样式', async () => {
  const allStyles: any[] = []
  const createStyle = () => {
    const el: any = {
      dataset: {} as Record<string, string>,
      textContent: '',
      isConnected: true,
      getAttribute: (k: string) => {
        if (k === 'data-plugin') return el.dataset.plugin ?? null
        if (k === 'data-plugin-css') return el.dataset.pluginCss ?? null
        return null
      },
      setAttribute: (k: string, v: string) => {
        if (k === 'data-plugin') el.dataset.plugin = v
        if (k === 'data-plugin-css') el.dataset.pluginCss = v
      },
      remove: () => {
        el.isConnected = false
        const idx = allStyles.indexOf(el)
        if (idx >= 0) allStyles.splice(idx, 1)
      },
    }
    allStyles.push(el)
    return el
  }

  // 模拟 DSH 0.2.0-rc.2 宿主的 claimStyles 与 removeOwnedStyles
  const hostClaimStyles = (id: string) => {
    for (const el of allStyles.filter(s => s.getAttribute('data-plugin') === null)) {
      el.setAttribute('data-plugin', id)
    }
  }
  const hostRemoveOwnedStyles = (id: string) => {
    for (const el of [...allStyles]) {
      if (el.getAttribute('data-plugin') === id) el.remove()
    }
  }

  vi.stubGlobal('document', {
    createElement: (tag: string) => tag === 'style' ? createStyle() : ({ dataset: {}, remove: () => {} }),
    head: { append: () => {} },
    documentElement: { append: () => {} },
  })
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} }, __ModuleLoader__: { load: () => {} } })

  const ctx = new Context()
  class Remote extends Service {
    constructor(context: Context) { super(context, 'remote') }
    get commands() { return { execute: async () => ({ ok: true, value: { result: { kind: 'success' } } }) } }
  }
  ctx.provide('sessions', { scope: () => ctx })
  ctx.provide('conversation', { input: { for: () => ({}) } })
  ctx.provide('slots', { inject: () => () => {}, register: () => () => {} })
  ctx.provide('commandUi', { candidates: async () => [], dispatch: () => ({}), matchSpace: () => ({}), matchEnter: async () => ({}), execute: async () => ({}) })
  const LocaleRuntime = hostLocaleRuntime()
  ctx.provide('locale', new LocaleRuntime(ctx))
  new Remote(ctx)

  const plugin = ctx.plugin({ apply: clientPlugin.apply })
  await plugin.await()

  const btwStyle = allStyles.find(s => s.dataset.michengaiBtw !== undefined)
  expect(btwStyle).toBeDefined()
  expect(btwStyle.dataset.plugin).toBe('@michengai/dsh-btw')
  expect(btwStyle.dataset.pluginCss).toBe('@michengai/dsh-btw/client.css')
  expect(btwStyle.textContent).toContain('.btw-selection-dialog,.btw-selection-menu{position:fixed;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2)')
  expect(btwStyle.textContent).toContain('.btw-bubble{background:var(--dsw-alias-bg-layer-2)')

  // 模拟宿主加载另一个插件
  hostClaimStyles('other-theme-plugin')
  expect(btwStyle.dataset.plugin).toBe('@michengai/dsh-btw')

  // 模拟另一个插件卸载/重载触发样式清理
  hostRemoveOwnedStyles('other-theme-plugin')
  expect(btwStyle.isConnected).toBe(true)

  // 模拟 BTW 自身卸载时正常清理
  await plugin.dispose()
  await ctx.fiber.dispose()
  expect(btwStyle.isConnected).toBe(false)
})
