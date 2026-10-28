import { expect, it } from 'vitest'
import { Config, readSettings, volatileField } from '../src/server/settings'
import { createAnswerOnlyGuard } from '../src/server/tool-guard'
import { MAX_PROMPT_LENGTH } from '../src/limits'

/**
 * 这三条约束来自宿主 `dsh-settings` 的实现，任何一条不满足都会让设置项
 * 「看得见但存不进」或「干脆不出现」，因此用测试钉死：
 *  1. 每个字段都有 `.default(...)`，否则 `projectForm()` 会把 resolved 为
 *     `undefined` 的字段整个丢掉；
 *  2. 每个可配置字段都是 volatile，否则 `volatileForm()` 返回 undefined，
 *     `describe()` 直接 `return []`，整个 entry 从设置命名空间消失；
 *  3. 默认值等价于「不配置」，与 1.1.1 的行为完全一致。
 */
it('设置 schema 的每个字段都带 default 且标记 volatile', () => {
  // schemastery 的 toJSON 是一张引用表：根节点按 uid 取回，对象字段的 dict 存的是
  // refs 下标而不是内联定义，所以断言必须顺着这两层走，不能直接读顶层 type/dict。
  const table = Config.toJSON() as {
    uid: number
    refs: Record<string, { type: string; meta?: { volatile?: boolean; default?: unknown }; dict?: Record<string, number> }>
  }
  const root = table.refs[String(table.uid)]
  expect(root?.type).toBe('object')
  const entries = Object.entries(root?.dict ?? {})
  expect(entries.map(([key]) => key).sort()).toEqual(['allowedTools', 'promptPrefix'])
  const fieldOf = (name: string) => {
    const ref = root?.dict?.[name]
    expect(typeof ref, `${name} 应指向 refs 中的定义`).toBe('number')
    return table.refs[String(ref)]!
  }
  expect(fieldOf('allowedTools').meta?.volatile, 'allowedTools 必须是 volatile').toBe(true)
  expect(fieldOf('promptPrefix').meta?.volatile, 'promptPrefix 必须是 volatile').toBe(true)
  expect(fieldOf('allowedTools').meta?.default).toEqual([])
  expect(fieldOf('promptPrefix').meta?.default).toBe('')
})

it('volatileField 在缺少 volatile() 的 schemastery 上退回 extra 标记', () => {
  const calls: string[] = []
  const legacy = {
    meta: {} as { volatile?: boolean },
    extra(key: string, value: unknown) { calls.push(`${key}=${String(value)}`); this.meta.volatile = value === true; return this },
  }
  expect(volatileField(legacy)).toBe(legacy)
  expect(calls).toEqual(['volatile=true'])
  const already = { meta: { volatile: true }, extra() { calls.push('should-not-run'); return this } }
  expect(volatileField(already)).toBe(already)
  expect(calls).toEqual(['volatile=true'])
})

it('未配置时读到空配置，旁问行为与 1.1.1 完全一致', () => {
  expect(readSettings(undefined)).toEqual({ allowedTools: [], promptPrefix: '' })
  expect(readSettings(null)).toEqual({ allowedTools: [], promptPrefix: '' })
  expect(readSettings({})).toEqual({ allowedTools: [], promptPrefix: '' })
  expect(readSettings({ allowedTools: [], promptPrefix: '' })).toEqual({ allowedTools: [], promptPrefix: '' })
  // 空配置返回同一个冻结对象，便于调用方按引用短路。
  expect(readSettings({})).toBe(readSettings(undefined))
})

it('白名单去空、去重、trim 并忽略非字符串条目', () => {
  expect(readSettings({ allowedTools: [' pele_draw ', '', 'pele_draw', 42, null, 'ops_bash'] }).allowedTools)
    .toEqual(['pele_draw', 'ops_bash'])
  expect(readSettings({ allowedTools: 'pele_draw' }).allowedTools).toEqual([])
  expect(readSettings({ allowedTools: [123] }).allowedTools).toEqual([])
})

it('白名单条目超长直接丢弃，不把畸形名字塞进放行集合', () => {
  const tooLong = 'x'.repeat(121)
  expect(readSettings({ allowedTools: [tooLong, 'ok'] }).allowedTools).toEqual(['ok'])
})

it('提示词 trim 后截断到上限，非字符串退回内置文案', () => {
  expect(readSettings({ promptPrefix: '  只给结论  ' }).promptPrefix).toBe('只给结论')
  expect(readSettings({ promptPrefix: 'x'.repeat(MAX_PROMPT_LENGTH + 50) }).promptPrefix).toHaveLength(MAX_PROMPT_LENGTH)
  expect(readSettings({ promptPrefix: 42 }).promptPrefix).toBe('')
})

it('volatile 字段到达插件时是 Cosmokit 引用对象，读值前会解包', () => {
  const volatile = <T>(value: T) => ({ get: () => value })
  expect(readSettings({ allowedTools: volatile(['pele_draw']), promptPrefix: volatile('只给结论') }))
    .toEqual({ allowedTools: ['pele_draw'], promptPrefix: '只给结论' })
})

it('白名单在闸门里逐次生效：加入后放行，移除后立刻恢复拒绝', () => {
  let allowed: readonly string[] = []
  const guard = createAnswerOnlyGuard(new Set(['owned']), undefined, () => allowed)
  const agent = { session: { header: { id: 'btw-child', parentSession: 'parent-session' } } }
  guard.own(agent)

  expect(guard({ agent, name: 'pele_draw', arguments: {} })).toContain('禁止执行任何工具')
  allowed = ['pele_draw']
  expect(guard({ agent, name: 'pele_draw', arguments: {} })).toBeUndefined()
  // 不在白名单里的工具照旧拒绝，放行集合不是「打开全部工具」。
  expect(guard({ agent, name: 'ops_bash', arguments: {} })).toContain('白名单工具')
  allowed = []
  expect(guard({ agent, name: 'pele_draw', arguments: {} })).toContain('禁止执行任何工具')
})

it('白名单非空时拒绝文案列出放行工具，空白名单保持 1.1.1 原文', () => {
  const agent = { session: {} }
  const strict = createAnswerOnlyGuard(new Set(['owned']), undefined, () => [])
  strict.own(agent)
  expect(strict({ agent, name: 'ops_bash', arguments: {} }))
    .toBe('BTW 仅允许文字回答，禁止执行任何工具。 / BTW allows text responses only; tool execution is strictly prohibited.')

  const permissive = createAnswerOnlyGuard(new Set(['owned']), undefined, () => ['pele_draw', 'ops_bash'])
  permissive.own(agent)
  const message = permissive({ agent, name: 'read_file', arguments: {} })
  expect(message).toContain('pele_draw, ops_bash')
  expect(message).toContain('白名单工具')
})

it('白名单写进 send_message 也不能让旁问把答案发给别的 agent', () => {
  const guard = createAnswerOnlyGuard(new Set(['owned']), undefined, () => ['send_message'])
  const agent = { session: { header: { id: 'btw-child', parentSession: 'parent-session' } } }
  guard.own(agent)
  // 回传工具的归属校验优先于白名单，配置无法绕过「只能交回自己的主会话」。
  expect(guard({ agent, name: 'send_message', arguments: { agent_id: 'someone-else' } })).toContain('禁止执行任何工具')
  expect(guard({ agent, name: 'send_message', arguments: { agent_id: 'parent-session' } })).toBeUndefined()
})

it('白名单只作用于被认领的旁问代理，主任务工具不受影响', () => {
  const guard = createAnswerOnlyGuard(new Set(['owned']), undefined, () => ['pele_draw'])
  expect(guard({ agent: { session: {} }, name: 'ops_bash', arguments: {} })).toBeUndefined()
})
