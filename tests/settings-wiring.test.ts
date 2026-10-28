import { Context, Service } from '@deepseek-ai/cordis'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'
import * as clientPlugin from '../src/client/index'
import { BUNDLE_NAME, ROW_CONFIG_KEY } from '../src/client/settings-scope'
import { hostLocaleRuntime } from './host-client-fixtures'

afterEach(() => vi.unstubAllGlobals())

/**
 * 客户端接线回归：只有在 `configForms` 服务到位时，才把设置卡片注册到
 * `plugins.row.config`，且 key 必须是宿主约定的 `<包名>#<patch 行 id>`。
 *
 * 这条缝隙最容易悄悄坏掉：服务名写错、key 写成包名、或忘了包 whileServed 式
 * 门控，都会让「插件页那一行没有配置按钮」，而单测全绿也发现不了。
 */

interface Registered {
  name: string
  key?: string
  priority?: number
  locale?: string
  component: unknown
}

function harness(options: { namespaces?: readonly string[]; withConfigForms?: boolean }) {
  const registered: Registered[] = []
  const ctx = new Context()
  const commandUi = {
    candidates: async () => [],
    dispatch: () => ({}),
    matchSpace: () => ({}),
    matchEnter: async () => ({}),
    execute: async () => ({}),
  }
  let implementation = clientPlugin
  const fallback = createRequire(import.meta.url)
  const safeRequire = ((id: string) => id === '@deepseek-ai/dsh-client-ui-primitives' ? { Modal: () => null, Button: () => null } : fallback(id)) as typeof fallback
  vi.stubGlobal('window', {
    localStorage: { getItem: () => null, setItem: () => {} },
    __ModuleLoader__: { load: (entry: { factory: (require: typeof fallback) => typeof clientPlugin }) => { implementation = entry.factory(safeRequire) } },
  })
  vi.stubGlobal('document', {
    createElement: () => ({ dataset: {}, textContent: '', remove: () => {} }),
    head: { append: () => {} },
    documentElement: { append: () => {} },
  })
  class Remote extends Service {
    constructor(context: Context) { super(context, 'remote') }
    get commands() { return commandUi }
  }
  ctx.provide('sessions', { scope: () => ctx })
  ctx.provide('conversation', { input: { for: () => ({}) } })
  ctx.provide('slots', {
    inject: (_name: string, callback: () => () => void) => callback(),
    // 宿主 slots.register 的签名是 (options, component)：组件是第二个参数，
    // 不是 options 的字段。这里照抄真实形状，才能验证到「卡片被交给槽」。
    register: (options: Omit<Registered, 'component'>, component: unknown) => {
      registered.push({ ...options, component })
      return () => {}
    },
  })
  ctx.provide('commandUi', commandUi)
  const LocaleRuntime = hostLocaleRuntime()
  ctx.provide('locale', new LocaleRuntime(ctx))
  new Remote(ctx)
  if (options.withConfigForms !== false) {
    const namespaces = (options.namespaces ?? [ROW_CONFIG_KEY.split('#')[1]!]).map(ns => ({ ns }))
    ctx.provide('configForms', {
      describe: () => ({
        getSnapshot: () => ({ status: 'ready', view: { namespaces } }),
        subscribe: () => () => {},
        load: () => Promise.resolve(),
      }),
      get: (entryId: string) => ({ getSnapshot: () => ({ status: 'ready', value: {}, writable: true, revision: 1 }), subscribe: () => () => {}, mutate: () => Promise.resolve(true), __entryId: entryId }),
    })
  }
  return { ctx, registered, implementation: () => implementation }
}

it('configForms 到位时把设置卡片注册到行级配置槽，key 与宿主约定的 `<包名>#<行 id>` 一致', async () => {
  const { ctx, registered, implementation } = harness({})
  const plugin = ctx.plugin((scope: Context) => { (implementation() as typeof clientPlugin).apply(scope) })
  try {
    await plugin.await()
    await new Promise(resolve => setImmediate(resolve))
    const card = registered.find(entry => entry.name === 'plugins.row.config')
    expect(card).toBeDefined()
    expect(card?.key).toBe(ROW_CONFIG_KEY)
    expect(card?.key).toBe(`${BUNDLE_NAME}#michengai-btw`)
    // 参考插件用 priority 30；同一槽里多个卡片按它排序，保持一致才不会打乱插件页的既有顺序。
    expect(card?.priority).toBe(30)
    expect(typeof card?.component).toBe('function')
  } finally {
    await plugin.dispose()
    await ctx.fiber.dispose()
  }
})

it('宿主没有 configForms 时整个客户端插件照常激活，只是不出设置卡片', async () => {
  const { ctx, registered, implementation } = harness({ withConfigForms: false })
  const plugin = ctx.plugin((scope: Context) => { (implementation() as typeof clientPlugin).apply(scope) })
  try {
    await plugin.await()
    await new Promise(resolve => setImmediate(resolve))
    expect(registered.some(entry => entry.name === 'plugins.row.config')).toBe(false)
    // 其余槽照常注册：缺设置服务不能把旁问本身也拖垮。
    expect(registered.some(entry => entry.name === 'conversation.input.dock')).toBe(true)
  } finally {
    await plugin.dispose()
    await ctx.fiber.dispose()
  }
})
