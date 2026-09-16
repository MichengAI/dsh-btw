import { expect, it } from 'vitest'
import { createAnswerOnlyGuard } from '../src/server/tool-guard'

const deprecated = () => { throw new Error('生产路径不应再读 snapshotEvents') }

it('拒绝旁问代理的所有执行，不影响主任务或其他子代理', () => {
  const labels = new Set(['michengai-btw:owned'])
  const guard = createAnswerOnlyGuard(labels)
  const agent = (label: string) => ({ session: { snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label } }] } })
  const owned = agent('michengai-btw:owned')
  expect(guard({ agent: owned })).toContain('禁止执行任何工具')
  expect(guard({ agent: agent('other') })).toBeUndefined()
  expect(guard({})).toBeUndefined()
  labels.clear()
  expect(guard({ agent: owned })).toContain('禁止执行任何工具')
})

it('继承的旧描述不误伤其他子代理', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const agent = { session: { snapshotEvents: () => [
    { type: 'subagent/descriptor', data: { label: 'michengai-btw:owned' } },
    { type: 'subagent/descriptor', data: { label: 'independent' } },
  ] } }
  expect(guard({ agent })).toBeUndefined()
})

it('认领后不再读 snapshotEvents', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const agent = { session: { snapshotEvents: deprecated } }
  guard.own(agent)
  expect(guard({ agent })).toContain('禁止执行任何工具')
  expect(guard({ agent: { session: {} } })).toBeUndefined()
})

it('session/event 增量描述符不再读 snapshotEvents', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const session = { snapshotEvents: deprecated }
  const agent = { session }
  guard.recognize(session, { type: 'subagent/descriptor', data: { label: 'michengai-btw:owned' } })
  expect(guard({ agent })).toContain('禁止执行任何工具')
  expect(guard({ agent: { session: { snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label: 'other' } }] } } })).toBeUndefined()
})

it('无关增量描述符不认领', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
  const session = { snapshotEvents: () => [] }
  guard.recognize(session, { type: 'subagent/descriptor', data: { label: 'other' } })
  guard.recognize(session, { type: 'turn/start', data: {} })
  expect(guard({ agent: { session } })).toBeUndefined()
})
