export interface SessionEventLike {
  readonly type: string
  readonly data?: unknown
}

export interface SessionIdentityHint {
  snapshotEvents?(): readonly SessionEventLike[]
}

export interface AgentIdentity {
  session?: object
}

export interface SubagentIdentityHint {
  readonly label?: string
}

export type IdentityOf = (session: object) => SubagentIdentityHint | null | undefined

export interface AnswerOnlyGuard {
  (execution: { agent?: AgentIdentity }): string | undefined
  own(agent: object): void
  recognize(session: object, event: SessionEventLike): void
}

const DENY = 'BTW 仅允许文字回答，禁止执行任何工具。'

function descriptorLabel(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('label' in data) || typeof data.label !== 'string') return undefined
  return data.label
}

/** 新宿主读 sessionProjections.subagent；没有投影缝时才回退已弃用的同步快照。 */
function lastDescriptorLabel(session: object | undefined, identityOf?: IdentityOf): string | undefined {
  if (!session) return undefined
  if (identityOf) {
    const identity = identityOf(session)
    return typeof identity?.label === 'string' ? identity.label : undefined
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
  const claim = (value: object | undefined) => {
    if (value) owned.add(value)
  }
  const guard: AnswerOnlyGuard = ({ agent }) => {
    if (!agent) return undefined
    if (owned.has(agent) || (agent.session !== undefined && owned.has(agent.session))) return DENY
    const label = lastDescriptorLabel(agent.session, identityOf)
    if (!label || !labels.has(label)) return undefined
    claim(agent)
    claim(agent.session)
    return DENY
  }
  guard.own = agent => { claim(agent) }
  guard.recognize = (session, event) => {
    if (event.type !== 'subagent/descriptor') return
    const label = descriptorLabel(event.data)
    if (label && labels.has(label)) claim(session)
  }
  return guard
}
