import { expect, it } from 'vitest'
import { createAnswerOnlyGuard, identityOfFromContext } from '../src/server/tool-guard'

const deprecated = () => { throw new Error('生产路径不应再读 snapshotEvents') }

it('投影身份拒绝旁问代理，不影响主任务或其他子代理', () => {
  const labels = new Set(['michengai-btw:owned'])
  const identityOf = (session: object) => (session as { label?: string }).label ? { label: (session as { label: string }).label } : null
  const guard = createAnswerOnlyGuard(labels, identityOf)
  const agent = (label: string) => ({ session: { label, snapshotEvents: deprecated } })
  const owned = agent('michengai-btw:owned')
  expect(guard({ agent: owned })).toContain('禁止执行任何工具')
  expect(guard({ agent: agent('other') })).toBeUndefined()
  expect(guard({})).toBeUndefined()
  labels.clear()
  expect(guard({ agent: owned })).toContain('禁止执行任何工具')
})

it('投影 last-wins 不把继承的旧描述当成当前旁问', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => ({ label: 'independent' }))
  expect(guard({ agent: { session: { snapshotEvents: deprecated } } })).toBeUndefined()
})

it('投影未解析到合法 label 时回退 snapshotEvents 拦截', () => {
  const session = { snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label: 'michengai-btw:owned' } }] }
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => null)
  expect(guard({ agent: { session } })).toContain('禁止执行任何工具')
})

it('ownId 凭会话或代理 ID 确定性拦截，脱钩生命周期时序与弱引用', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const unregister = guard.ownId('child-123')
  expect(guard({ agent: { id: 'child-123' } })).toContain('禁止执行任何工具')
  expect(guard({ agent: { session: { header: { id: 'child-123' } } } })).toContain('禁止执行任何工具')
  expect(guard({ agent: { session: { id: 'child-123' } } })).toContain('禁止执行任何工具')
  expect(guard({ agent: { id: 'other' } })).toBeUndefined()
  unregister()
  expect(guard({ agent: { id: 'child-123' } })).toBeUndefined()
})

it('own 同时 claim agent 及其 session，避免代理对象引用变化导致漏拦', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const session = {}
  const originalAgent = { session }
  guard.own(originalAgent)
  const wrappedAgent = { session }
  expect(guard({ agent: wrappedAgent })).toContain('禁止执行任何工具')
})

it('认领后不再读投影或 snapshotEvents', () => {
  let reads = 0
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => { reads += 1; return null })
  const agent = { session: { snapshotEvents: deprecated } }
  guard.own(agent)
  expect(guard({ agent })).toContain('禁止执行任何工具')
  expect(reads).toBe(0)
  expect(guard({ agent: { session: {} } })).toBeUndefined()
  expect(reads).toBe(1)
})

it('session/event 增量描述符不再读投影或 snapshotEvents', () => {
  let reads = 0
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => { reads += 1; return null })
  const session = { snapshotEvents: deprecated }
  const agent = { session }
  guard.recognize(session, { type: 'subagent/descriptor', data: { label: 'michengai-btw:owned' } })
  expect(guard({ agent })).toContain('禁止执行任何工具')
  expect(reads).toBe(0)
  expect(guard({ agent: { session: {} } })).toBeUndefined()
  expect(reads).toBe(1)
})

it('无关增量描述符不认领', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => null)
  const session = {}
  guard.recognize(session, { type: 'subagent/descriptor', data: { label: 'other' } })
  guard.recognize(session, { type: 'turn/start', data: {} })
  expect(guard({ agent: { session } })).toBeUndefined()
})

it('没有投影服务时仍可读 snapshotEvents', () => {
  const labels = new Set(['michengai-btw:owned'])
  const guard = createAnswerOnlyGuard(labels)
  const agent = (label: string) => ({ session: { snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label } }] } })
  expect(guard({ agent: agent('michengai-btw:owned') })).toContain('禁止执行任何工具')
  expect(guard({ agent: agent('other') })).toBeUndefined()
})

it('从 sessionProjections.snapshot 读取 subagent 身份', () => {
  const snapshot = (session: object, keys: readonly ['subagent']) => {
    expect(keys).toEqual(['subagent'])
    return { values: { subagent: { label: (session as { id: string }).id } } }
  }
  const identityOf = identityOfFromContext({ get: (name: string) => name === 'sessionProjections' ? { snapshot } : undefined })
  expect(identityOf?.({ id: 'michengai-btw:owned' })).toEqual({ label: 'michengai-btw:owned' })
  expect(identityOfFromContext({ get: () => { throw new Error('missing') } })).toBeUndefined()
  expect(identityOfFromContext({ get: () => ({ snapshot: () => { throw new Error('bad session') } }) })?.({})).toBeNull()
})
