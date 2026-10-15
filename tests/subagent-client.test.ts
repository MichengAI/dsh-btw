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
  const loader = { load: (entry: { factory: (require: ReturnType<typeof createRequire>) => typeof clientPlugin }) => {
    implementation = entry.factory(createRequire(import.meta.url))
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
  ctx.provide('slots', {
    inject: (_name: string, register: () => void) => { register(); return () => {} },
    register: (spec: { name: string }, component: unknown) => {
      if (spec.name === 'conversation.input.dock') dock = component as Dock
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
  return { ctx, commands, execute, addresses, rows, children, store }
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

it('关闭比启动结果更早收到所有权拒绝时，没有答案的气泡直接移除', async () => {
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
    expect(store.getSnapshot()).toEqual([])
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
    expect(store.getSnapshot()[0]?.phase).toBe('error')
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
