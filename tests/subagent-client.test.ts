import React from 'react'
import { Context, Service } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInThisContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import * as clientPlugin from '../src/client/index'
import type { BubbleStore } from '../src/client/bubbles'
import { translate } from '../src/locales'
import { hostLocaleRuntime } from './host-client-fixtures'

const tick = () => new Promise<void>(resolve => setImmediate(resolve))
afterEach(() => vi.unstubAllGlobals())

type SessionHint = { sessionId: string; subagent?: object | null }
type DockProps = { session: SessionHint; t: ReturnType<typeof translate> }
type Dock = (props: DockProps) => React.ReactElement<{ children: React.ReactNode }>

/** 只替换传输响应；使用真实 Cordis、客户端入口和气泡状态。 */
async function setup() {
  const ctx = new Context()
  const execute = vi.fn(async (_session: string, _line: string, _attachments: unknown[], _signal?: AbortSignal): Promise<unknown> => ({ ok: true, value: { result: { kind: 'success', text: '回答' } } }))
  const commands = {
    candidates: vi.fn(async (_session?: unknown) => [{ name: 'btw' }, { name: 'compact' }]),
    dispatch: vi.fn((_pick: unknown): unknown => 'host'),
    matchSpace: vi.fn((_session: unknown, _token: string): unknown => undefined),
    matchEnter: vi.fn(async (_session: unknown, _line: string, _signal: AbortSignal, _envelope: object): Promise<unknown> => undefined),
    execute: vi.fn(async (_session: unknown, _line: string): Promise<unknown> => ({ kind: 'success' })),
  }
  const addresses = new Set<string>()
  const rows: Record<string, { origin?: 'subagent'; parentId?: string }> = {}
  let dock!: Dock
  let implementation = clientPlugin
  const fallback = createRequire(import.meta.url)
  const safeRequire = ((id: string) => id === '@deepseek-ai/dsh-client-ui-primitives' ? { Modal: () => null, Button: () => null } : fallback(id)) as typeof fallback
  const loader = { load: (entry: { factory: (require: typeof fallback) => typeof clientPlugin }) => {
    implementation = entry.factory(safeRequire)
  } }
  vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} }, __ModuleLoader__: loader })
  vi.stubGlobal('document', {
    createElement: () => ({ dataset: {}, remove: () => {} }),
    head: { append: () => {} },
  })
  ctx.provide('sessions', {
    scope: () => ctx,
    subagentAddress: (id: string) => addresses.has(id) ? { childSessionId: id } : undefined,
    list: { getSnapshot: () => ({ byId: rows }) },
  })
  ctx.provide('conversation', { input: { for: () => ({}) } })
  ctx.provide('commandUi', commands)
  const commandViews = new Map<string, () => unknown>()
  ctx.provide('slots', {
    inject: (_name: string, register: () => void) => { register(); return () => {} },
    register: (spec: { name: string; key?: string }, component: unknown) => {
      if (spec.name === 'conversation.input.dock') dock = component as Dock
      if (spec.name === 'conversation.chat.commandview' && spec.key) {
        commandViews.set(spec.key, component as () => unknown)
      }
      return () => {}
    },
  })
  const LocaleRuntime = hostLocaleRuntime()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('remote.commands', { execute })
  class Remote extends Service {
    constructor() { super(ctx, 'remote') }
    get commands() { return { execute } }
  }
  new Remote()
  try {
    if (process.env.DSH_BTW_BUNDLE === '1') runInThisContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
    await ctx.plugin(implementation).await()
  } catch (error) {
    await ctx.fiber.dispose()
    throw error
  }
  const children = (session: SessionHint) => React.Children.toArray(dock({ session, t: translate() }).props.children)
    .filter((node): node is React.ReactElement<{ store: BubbleStore }> => React.isValidElement(node))
  const store = () => children({ sessionId: 'main', subagent: null }).find(node => typeof node.type === 'function' && node.type.name === 'BubbleDock')!.props.store
  return { ctx, commands, execute, addresses, rows, children, store, commandViews }
}

it('子代理不显示旁问候选或认领命令，普通分叉会话仍可用', async () => {
  const h = await setup()
  try {
    h.addresses.add('addressed-child')
    h.rows['listed-child'] = { origin: 'subagent', parentId: 'main' }
    h.rows['ordinary-fork'] = { parentId: 'main' }
    for (const id of ['addressed-child', 'listed-child']) {
      const session = { sessionId: id }
      await expect(h.commands.candidates(session)).resolves.toEqual([{ name: 'compact' }])
      expect(h.commands.matchSpace(session, '/btw')).toBeUndefined()
      expect(h.commands.dispatch({ session, candidate: { name: 'btw' } })).toBeUndefined()
      await expect(h.commands.matchEnter(session, '/btw 问题', new AbortController().signal, {})).rejects.toThrow('subagent')
      await expect(h.commands.execute(session, '/btw 问题')).resolves.toMatchObject({ kind: 'error' })
    }
    expect(h.commands.matchSpace({ sessionId: 'ordinary-fork' }, '/btw')).toHaveProperty('claim')
    expect(h.execute).not.toHaveBeenCalled()
  } finally { await h.ctx.fiber.dispose() }
})

it('已取得的认领在身份变成子代理后拒绝提交，避免迟到认领绕过检查', async () => {
  const h = await setup()
  try {
    const picked = h.commands.matchSpace({ sessionId: 'late-child' }, '/btw') as { claim: { submit: (args: string, ctx: Context, attachments: unknown[]) => Promise<unknown> } }
    h.addresses.add('late-child')
    await expect(picked.claim.submit('问题', h.ctx, [])).resolves.toMatchObject({ kind: 'error' })
    expect(h.execute).not.toHaveBeenCalled()
    expect(h.store().getSnapshot()).toEqual([])
  } finally { await h.ctx.fiber.dispose() }
})

it('子代理 dock 不挂划词旁问，但保留已有气泡的关闭入口', async () => {
  const h = await setup()
  try {
    const names = (session: SessionHint) => h.children(session).map(node => typeof node.type === 'function' ? node.type.name : node.type)
    expect(names({ sessionId: 'main', subagent: null })).toEqual(['SelectionAsk', 'BubbleDock'])
    expect(names({ sessionId: 'child', subagent: { address: {} } })).toEqual(['BubbleDock'])
    h.rows['old-child'] = { origin: 'subagent' }
    expect(names({ sessionId: 'old-child' })).toEqual(['BubbleDock'])
  } finally { await h.ctx.fiber.dispose() }
})

it('关闭比启动结果更早收到所有权拒绝时，不把仍在飞的请求当成没启动', async () => {
  const h = await setup()
  try {
    h.execute.mockImplementation(async (session: string, line: string) => {
      if (line.startsWith('/btw-close')) return { ok: false, error: {
        code: 'session/agent-busy', message: `session "${session}" is owned by subagent routing`,
      } }
      return new Promise(() => {})
    })
    const store = h.store()
    const id = await store.ask('child', '问题')
    await store.close(id)
    expect(store.getSnapshot()[0]).toMatchObject({ id, closeFailed: true, answer: '' })
    expect(h.execute).toHaveBeenCalledTimes(2)
  } finally { await h.ctx.fiber.dispose() }
})

it('关闭被围栏拒绝后，启动也以同一围栏拒绝时才本地移除', async () => {
  const h = await setup()
  let finishRun!: (value: unknown) => void
  try {
    h.execute.mockImplementation(async (session: string, line: string) => {
      if (line.startsWith('/btw-close')) return { ok: false, error: {
        code: 'session/agent-busy', message: `session "${session}" is owned by subagent routing`,
      } }
      return new Promise(resolve => { finishRun = resolve })
    })
    const store = h.store()
    const id = await store.ask('child', '问题')
    await store.close(id)
    expect(store.getSnapshot()).toHaveLength(1)
    finishRun({ ok: false, error: {
      code: 'session/agent-busy', message: 'session "child" is owned by subagent routing',
    } })
    await tick()
    expect(store.getSnapshot()).toEqual([])
  } finally { await h.ctx.fiber.dispose() }
})

it('关闭被围栏拒绝后启动仍成功时，保留答案和重试入口', async () => {
  const h = await setup()
  let finishRun!: (value: unknown) => void
  try {
    h.execute.mockImplementation(async (session: string, line: string) => {
      if (line.startsWith('/btw-close')) return { ok: false, error: {
        code: 'session/agent-busy', message: `session "${session}" is owned by subagent routing`,
      } }
      return new Promise(resolve => { finishRun = resolve })
    })
    const store = h.store()
    const id = await store.ask('child', '问题')
    await store.close(id)
    finishRun({ ok: true, value: { result: { kind: 'success', text: '迟到的回答' } } })
    await tick()
    expect(store.getSnapshot()[0]).toMatchObject({ id, answer: '迟到的回答', closeFailed: true })
  } finally { await h.ctx.fiber.dispose() }
})

it.each(['agent-busy', 'session/agent-busy'])('启动被所有权围栏明确拒绝后可本地关闭，不重复请求（%s）', async code => {
  const h = await setup()
  try {
    h.execute.mockResolvedValue({ ok: false, error: {
      code,
      message: 'session "child" is owned by subagent routing',
      details: { reason: 'use subagent delivery for this child session' },
    } })
    const store = h.store()
    const id = await store.ask('child', '问题')
    await tick()
    expect(store.getSnapshot()[0]).toMatchObject({
      phase: 'error',
      error: 'Side questions are not supported in subagent sessions. Use /btw in the main session.',
    })
    await store.close(id)
    expect(store.getSnapshot()).toEqual([])
    expect(h.execute).toHaveBeenCalledTimes(1)
  } finally { await h.ctx.fiber.dispose() }
})

it('已返回答案的请求在关闭时被围栏拒绝，仍保留答案和重试入口', async () => {
  const h = await setup()
  try {
    const store = h.store()
    const id = await store.ask('child', '问题')
    await tick()
    h.execute.mockResolvedValue({ ok: false, error: {
      code: 'session/agent-busy', message: 'session "child" is owned by subagent routing',
    } })
    await store.close(id)
    expect(store.getSnapshot()[0]).toMatchObject({ id, answer: '回答', closeFailed: true })
  } finally { await h.ctx.fiber.dispose() }
})

it('只凭 details.reason 也能认出所有权围栏，不依赖英文文案', async () => {
  const h = await setup()
  try {
    h.execute.mockResolvedValue({ ok: false, error: {
      code: 'session/agent-busy',
      message: 'subagent Sessions require their durable parent address',
      details: { reason: 'use subagent delivery for this child session' },
    } })
    const store = h.store()
    const id = await store.ask('child', '问题')
    await tick()
    await store.close(id)
    expect(store.getSnapshot()).toEqual([])
    expect(h.execute).toHaveBeenCalledTimes(1)
  } finally { await h.ctx.fiber.dispose() }
})

it('一般 agent-busy 或断网不丢弃气泡，保留关闭重试', async () => {
  const h = await setup()
  try {
    h.execute.mockResolvedValue({ ok: false, error: { code: 'session/agent-busy', message: '会话正忙' } })
    const store = h.store()
    const id = await store.ask('main', '问题')
    await tick()
    await store.close(id)
    expect(store.getSnapshot()[0]).toMatchObject({ id, closeFailed: true })
    expect(h.execute).toHaveBeenCalledTimes(2)
  } finally { await h.ctx.fiber.dispose() }
})

it('长耗时旁问断线恢复：execute 发生 Failed to fetch 时通过 query 接力取回答案', async () => {
  const h = await setup()
  try {
    let callCount = 0
    h.execute.mockImplementation(async (_session: string, line: string) => {
      callCount++
      if (line.includes('/btw-run')) {
        // 模拟 300s 长连接断开抛出 Failed to fetch
        return { ok: false, error: { code: 'network-error', message: 'client api: commands/execute failed: Failed to fetch' } }
      }
      if (line.includes('/btw-query')) {
        // 第一次查询正在运行，第二次查询成功完成
        if (callCount === 2) {
          return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({ state: 'running' }) } } }
        }
        return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({ state: 'done', result: { kind: 'success', text: '长耗时旁问最终答案' } }) } } }
      }
      return { ok: true, value: { result: { kind: 'success', text: '' } } }
    })
    const store = h.store()
    const id = await store.ask('main', '深度思考长问题')
    // 气泡处于 answering
    expect(store.getSnapshot().find(item => item.id === id)?.phase).toBe('answering')

    // 等待恢复轮询推进
    for (let i = 0; i < 40; i++) {
      await tick()
      await new Promise(r => setTimeout(r, 50))
      if (store.getSnapshot().find(item => item.id === id)?.phase === 'done') break
    }

    const item = store.getSnapshot().find(b => b.id === id)
    expect(item?.phase).toBe('done')
    expect(item?.answer).toBe('长耗时旁问最终答案')
    expect(item?.error).toBeUndefined()
  } finally { await h.ctx.fiber.dispose() }
})

it('长耗时旁问轮询期间用户关闭气泡，立即停止轮询并触发关闭命令', async () => {
  const h = await setup()
  try {
    h.execute.mockImplementation(async (_session: string, line: string) => {
      if (line.includes('/btw-run')) {
        return { ok: false, error: { code: 'network-error', message: 'Failed to fetch' } }
      }
      if (line.includes('/btw-query')) {
        return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({ state: 'running' }) } } }
      }
      if (line.includes('/btw-close')) {
        return { ok: true, value: { result: { kind: 'success', text: '' } } }
      }
      return { ok: true, value: { result: { kind: 'success', text: '' } } }
    })
    const store = h.store()
    const id = await store.ask('main', '取消测试题')
    await tick()

    // 用户在轮询期间关闭气泡
    await store.close(id)
    expect(store.getSnapshot()).toEqual([])
    expect(h.execute).toHaveBeenCalledWith('main', expect.stringContaining('/btw-close '), [], undefined)
  } finally { await h.ctx.fiber.dispose() }
})

it('HTTP 路由返回 404 时标记路由不可用，后续轮询不再发起 fetch 请求', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ status: 404, ok: false })
  const h = await setup()
  ;(window as any).fetch = fetchMock
  try {
    let queryCount = 0
    h.execute.mockImplementation(async (_session: string, line: string) => {
      if (line.includes('/btw-run')) {
        return { ok: false, error: { code: 'network-error', message: 'Failed to fetch' } }
      }
      if (line.includes('/btw-query')) {
        queryCount++
        if (queryCount === 1) {
          return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({ state: 'running' }) } } }
        }
        return { ok: true, value: { result: { kind: 'success', text: JSON.stringify({ state: 'done', result: { kind: 'success', text: '404后正常取回答案' } }) } } }
      }
      return { ok: true, value: { result: { kind: 'success', text: '' } } }
    })
    const store = h.store()
    const id = await store.ask('main', '404测试题')

    for (let i = 0; i < 40; i++) {
      await tick()
      await new Promise(r => setTimeout(r, 50))
      if (store.getSnapshot().find(item => item.id === id)?.phase === 'done') break
    }

    const item = store.getSnapshot().find(b => b.id === id)
    expect(item?.phase).toBe('done')
    expect(item?.answer).toBe('404后正常取回答案')
    // 第一次探测到 404 后，后续轮询周期不再发起 fetch 请求
    expect(fetchMock).toHaveBeenCalledTimes(1)
  } finally {
    await h.ctx.fiber.dispose()
  }
})

it('所有查询通道持续网络报错且达到连续失败上限时，判定传输断开并结束轮询抛错', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.fn().mockRejectedValue(new Error('Network dead'))
  const h = await setup()
  ;(window as any).fetch = fetchMock
  try {
    h.execute.mockImplementation(async (_session: string, line: string) => {
      if (line.includes('/btw-run')) {
        return { ok: false, error: { code: 'network-error', message: 'Failed to fetch' } }
      }
      if (line.includes('/btw-query')) {
        return { ok: false, error: { code: 'network-error', message: 'Transport broken' } }
      }
      return { ok: true, value: { result: { kind: 'success', text: '' } } }
    })
    const store = h.store()
    const id = await store.ask('main', '网络彻底断开测试题')

    await vi.advanceTimersByTimeAsync(20_000)

    const item = store.getSnapshot().find(b => b.id === id)
    expect(item?.phase).toBe('error')
    expect(item?.error).toContain('Transport broken')
  } finally {
    vi.useRealTimers()
    await h.ctx.fiber.dispose()
  }
})

it('conversation.chat.commandview 槽覆盖所有内部命令且返回 null，防止渲染通用命令卡片', async () => {
  const h = await setup()
  try {
    expect([...h.commandViews.keys()].sort()).toEqual(['btw-close', 'btw-query', 'btw-run'])
    for (const key of ['btw-close', 'btw-query', 'btw-run']) {
      expect(h.commandViews.get(key)!()).toBeNull()
    }
  } finally {
    await h.ctx.fiber.dispose()
  }
})
