export interface SessionEventLike {
  readonly type: string
  readonly data?: unknown
}

export interface SessionIdentityHint {
  snapshotEvents?(): readonly SessionEventLike[]
}

export interface AgentIdentity {
  id?: string
  session?: {
    id?: string
    header?: { id?: string }
    snapshotEvents?(): readonly SessionEventLike[]
  } | object
}

export interface SubagentIdentityHint {
  readonly label?: string
}

export type IdentityOf = (session: object) => SubagentIdentityHint | null | undefined

export interface AnswerOnlyGuard {
  (execution: { agent?: AgentIdentity }): string | undefined
  own(agent: object): void
  ownId(id: string): () => void
  recognize(session: object, event: SessionEventLike): void
}

const DENY = 'BTW 仅允许文字回答，禁止执行任何工具。 / BTW allows text responses only; tool execution is strictly prohibited.'

function descriptorLabel(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('label' in data) || typeof data.label !== 'string') return undefined
  return data.label
}

/** 有 sessionProjections 时优先读 subagent；投影未返回合法标签时回退同步快照。0.2.0-rc.1 仍有 snapshotEvents。 */
function lastDescriptorLabel(session: object | undefined, identityOf?: IdentityOf): string | undefined {
  if (!session) return undefined
  if (identityOf) {
    const identity = identityOf(session)
    if (typeof identity?.label === 'string') return identity.label
  }
  const events = (session as SessionIdentityHint).snapshotEvents
  if (typeof events !== 'function') return undefined
  return descriptorLabel(events().findLast(item => item.type === 'subagent/descriptor')?.data)
}

/** 官方替换同步事件扫描：ctx.sessionProjections.snapshot(session, ['subagent']).values.subagent */
export function identityOfFromContext(ctx: { get(name: string): unknown }): IdentityOf | undefined {
  try {
    const projections = ctx.get('sessionProjections') as { snapshot?(session: object, keys: readonly ['subagent']): { values?: { subagent?: SubagentIdentityHint | null } } } | undefined
    const snapshot = projections?.snapshot
    if (typeof snapshot !== 'function') return undefined
    return session => {
      try { return snapshot(session, ['subagent']).values?.subagent ?? null }
      catch { return null }
    }
  } catch { return undefined }
}

/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具。 */
export function createAnswerOnlyGuard(labels: ReadonlySet<string>, identityOf?: IdentityOf): AnswerOnlyGuard {
  const owned = new WeakSet<object>()
  const ownedIds = new Set<string>()
  const claim = (value: object | undefined) => {
    if (value && typeof value === 'object') owned.add(value)
  }
  const claimAgent = (agent: object | undefined) => {
    if (!agent) return
    claim(agent)
    if (typeof agent === 'object' && 'session' in agent) {
      claim((agent as { session?: object }).session)
    }
  }
  const isOwnedId = (agent: AgentIdentity): boolean => {
    if (ownedIds.size === 0) return false
    if (typeof agent.id === 'string' && ownedIds.has(agent.id)) return true
    const session = agent.session as { id?: unknown; header?: { id?: unknown } } | undefined
    if (session && typeof session === 'object') {
      if (typeof session.id === 'string' && ownedIds.has(session.id)) return true
      if (typeof session.header?.id === 'string' && ownedIds.has(session.header.id)) return true
    }
    return false
  }

  const guard: AnswerOnlyGuard = ({ agent }) => {
    if (!agent) return undefined
    if (isOwnedId(agent)) return DENY
    if (owned.has(agent) || (agent.session !== undefined && owned.has(agent.session))) return DENY
    const label = lastDescriptorLabel(agent.session, identityOf)
    if (!label || !labels.has(label)) return undefined
    claimAgent(agent)
    return DENY
  }
  guard.own = agent => { claimAgent(agent) }
  guard.ownId = id => {
    ownedIds.add(id)
    return () => { ownedIds.delete(id) }
  }
  guard.recognize = (session, event) => {
    if (event.type !== 'subagent/descriptor') return
    const label = descriptorLabel(event.data)
    if (label && labels.has(label)) claim(session)
  }
  return guard
}
