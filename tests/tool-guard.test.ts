import { describe, expect, it } from 'vitest'
import { createAnswerOnlyGuard, identityOfFromContext, parentNameOfFromContext } from '../src/server/tool-guard'

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

it('快照读取抛错时按 fail-open 放行，不把异常冒进工具执行链', () => {
  const guard = createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => null)
  const session = { snapshotEvents: () => { throw new Error('corrupt session log') } }
  expect(() => guard({ agent: { session } })).not.toThrow()
  expect(guard({ agent: { session } })).toBeUndefined()
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

describe('主动回传：只放行发给父会话的 send_message', () => {
  const guard = () => createAnswerOnlyGuard(new Set(['michengai-btw:owned']), () => null)
  const owned = (parentSession?: string) => ({
    session: { header: parentSession === undefined ? {} : { parentSession } },
  })
  const reply = { name: 'send_message', arguments: { agent_id: 'parent-1', message: '回答' } }

  it('认领后的旁问代理可以把答案发回自己的父会话', () => {
    const protection = guard()
    const agent = owned('parent-1')
    protection.own(agent)
    expect(protection({ agent, ...reply })).toBeUndefined()
  })

  // 1.0.9 之后生产上主要靠预登记 childId 认领（#21 的现场就是 agent 对象没被 own 到），
  // verdict 必须贯穿这条路径，否则回传通道在实际运行时不生效。
  it('只凭预登记 childId 认领时也放行回传，其余工具仍拒绝', () => {
    const protection = guard()
    const unregister = protection.ownId('child-9')
    const agent = { id: 'child-9', session: { header: { id: 'child-9', parentSession: 'parent-1' } } }
    expect(protection({ agent, ...reply })).toBeUndefined()
    expect(protection({ agent, name: 'send_message', arguments: { agent_id: 'other', message: '回答' } })).toContain('禁止执行任何工具')
    expect(protection({ agent, name: 'ops_bash', arguments: {} })).toContain('禁止执行任何工具')
    unregister()
  })

  it('快照回退认领的旁问代理同样可以回传', () => {
    const protection = createAnswerOnlyGuard(new Set(['michengai-btw:owned']))
    const agent = {
      session: {
        header: { parentSession: 'parent-1' },
        snapshotEvents: () => [{ type: 'subagent/descriptor', data: { label: 'michengai-btw:owned' } }],
      },
    }
    expect(protection({ agent, ...reply })).toBeUndefined()
    // 首次回传已认领该代理，之后同代理的其它工具一律拒绝
    expect(protection({ agent, name: 'ops_bash', arguments: {} })).toContain('禁止执行任何工具')
  })

  it('发给其它 agent 仍然被拒', () => {
    const protection = guard()
    const agent = owned('parent-1')
    protection.own(agent)
    expect(protection({ agent, name: 'send_message', arguments: { agent_id: 'other', message: '回答' } })).toContain('禁止执行任何工具')
    expect(protection({ agent, name: 'send_message', arguments: {} })).toContain('禁止执行任何工具')
  })

  it('没有父会话时不存在回传通道', () => {
    const protection = guard()
    const agent = owned()
    protection.own(agent)
    expect(protection({ agent, ...reply })).toContain('禁止执行任何工具')
  })

  it('除 send_message 外的工具不被放行', () => {
    const protection = guard()
    const agent = owned('parent-1')
    protection.own(agent)
    expect(protection({ agent, name: 'read_file', arguments: { agent_id: 'parent-1' } })).toContain('禁止执行任何工具')
  })

  it('非旁问代理不受影响', () => {
    const protection = guard()
    const agent = owned('parent-1')
    expect(protection({ agent, name: 'read_file', arguments: {} })).toBeUndefined()
    expect(protection({ agent, name: 'send_message', arguments: { agent_id: 'other' } })).toBeUndefined()
  })

  it('0.2.2-rc.2+ 支持 send_message({ agent }) 且当父会话为树根时放行 "lead"', () => {
    const protection = createAnswerOnlyGuard(
      new Set(['michengai-btw:owned']),
      () => null,
      () => [],
      () => 'lead',
    )
    const agent = owned('parent-1')
    protection.own(agent)
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'lead', message: '回答' } })).toBeUndefined()
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'parent-1', message: '回答' } })).toBeUndefined()
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'other', message: '回答' } })).toContain('禁止执行任何工具')
  })

  it('二级子代理触发旁问时，绝不把 "lead" 误放行给祖父/树根', () => {
    const protection = createAnswerOnlyGuard(
      new Set(['michengai-btw:owned']),
      () => null,
      () => [],
      () => 'worker',
    )
    const agent = owned('worker-session-id')
    protection.own(agent)
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'lead', message: '越权' } })).toContain('禁止执行任何工具')
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'worker', message: '回答' } })).toBeUndefined()
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'worker-session-id', message: '回答' } })).toBeUndefined()
  })

  it('同时传入 agent 与 agent_id 且值不一致时一律拒绝', () => {
    const protection = createAnswerOnlyGuard(
      new Set(['michengai-btw:owned']),
      () => null,
      () => [],
      () => 'lead',
    )
    const agent = owned('parent-1')
    protection.own(agent)
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'lead', agent_id: 'other', message: '回答' } })).toContain('禁止执行任何工具')
    expect(protection({ agent, name: 'send_message', arguments: { agent: 'parent-1', agent_id: 'parent-1', message: '回答' } })).toBeUndefined()
  })

  it('parentNameOfFromContext 保留 subagents 的 this 上下文，并安全区分直接父会话与树根', () => {
    const rootAgent = { id: 'root-1' }
    const workerAgent = { id: 'worker-1' }
    const btwFromRoot = { id: 'btw-1', session: { header: { parentSession: 'root-1' } } }
    const btwFromWorker = { id: 'btw-2', session: { header: { parentSession: 'worker-1' } } }
    const subagents = {
      tag: 'bound',
      namesOf(this: { tag: string }, agent: object) {
        if (this.tag !== 'bound') throw new Error('lost this')
        if (agent === btwFromRoot) return { self: 'agent-1', parent: 'lead' }
        if (agent === btwFromWorker) return { self: 'worker/agent-1', parent: 'worker' }
        throw new Error('not resident')
      },
      rootOf(this: { tag: string }, agent: object) {
        if (this.tag !== 'bound') throw new Error('lost this')
        if (agent === btwFromRoot || agent === btwFromWorker) return rootAgent
        return agent
      },
    }
    const parentNameOf = parentNameOfFromContext({ get: (name: string) => name === 'subagents' ? subagents : undefined })
    expect(parentNameOf?.(btwFromRoot, 'root-1')).toBe('lead')
    expect(parentNameOf?.(btwFromWorker, 'worker-1')).toBe('worker')
    // namesOf 抛错时回退 rootOf：只有 root.id === parentSession 且 root !== agent 才返回 'lead'
    const fallbackOnlyRoot = { id: 'btw-3', session: { header: { parentSession: 'root-1' } } }
    const subagentsFallback = {
      tag: 'bound',
      namesOf() { throw new Error('not resident') },
      rootOf(this: { tag: string }, agent: object) {
        if (this.tag !== 'bound') throw new Error('lost this')
        if (agent === fallbackOnlyRoot || agent === btwFromWorker) return rootAgent
        return agent
      },
    }
    const fallbackResolver = parentNameOfFromContext({ get: (name: string) => name === 'subagents' ? subagentsFallback : undefined })
    expect(fallbackResolver?.(fallbackOnlyRoot, 'root-1')).toBe('lead')
    expect(fallbackResolver?.(btwFromWorker, 'worker-1')).toBeUndefined()
  })
})
