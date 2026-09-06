import { expect, it } from 'vitest'
import { createAnswerOnlyGuard } from '../src/server/tool-guard'

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
