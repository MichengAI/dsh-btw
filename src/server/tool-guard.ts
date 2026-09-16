export interface SessionEventLike {
  readonly type: string
  readonly data?: unknown
}

export interface SessionIdentityHint {
  snapshotEvents?(): readonly SessionEventLike[]
}

export interface AgentIdentity {
  session?: SessionIdentityHint
}

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

/** 描述符不进 deriveMessages；无增量时才回退已弃用的同步快照。 */
function lastDescriptorLabel(session?: SessionIdentityHint): string | undefined {
  if (typeof session?.snapshotEvents !== 'function') return undefined
  const event = session.snapshotEvents().findLast(item => item.type === 'subagent/descriptor')
  return descriptorLabel(event?.data)
}

/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具。 */
export function createAnswerOnlyGuard(labels: ReadonlySet<string>): AnswerOnlyGuard {
  const owned = new WeakSet<object>()
  const claim = (value: object | undefined) => {
    if (value) owned.add(value)
  }
  const guard: AnswerOnlyGuard = ({ agent }) => {
    if (!agent) return undefined
    if (owned.has(agent) || (agent.session !== undefined && owned.has(agent.session))) return DENY
    const label = lastDescriptorLabel(agent.session)
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
