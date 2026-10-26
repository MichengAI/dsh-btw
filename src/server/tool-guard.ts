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

/**
 * The single inherited tool a side ask may call, and only addressed at its own
 * parent. Reusing the host's `send_message` — rather than registering a new
 * side-ask tool — keeps the side-ask request's tool list byte-identical to the
 * parent's, which is what makes the prompt cache reusable
 * (`tests/cache-prefix.test.ts`).
 */
export const REPLY_TOOL = 'send_message'

export interface AnswerOnlyGuard {
  (execution: { agent?: AgentIdentity; name?: string; arguments?: unknown }): string | undefined
  own(agent: object): void
  recognize(session: object, event: SessionEventLike): void
}

const DENY = 'BTW 仅允许文字回答，禁止执行任何工具。 / BTW allows text responses only; tool execution is strictly prohibited.'

/** The parent session a side-ask child could return an answer to, when it has one. */
export function parentSessionOf(agent: AgentIdentity | undefined): string | undefined {
  const parent = (agent?.session as { header?: { parentSession?: unknown } } | undefined)?.header?.parentSession
  return typeof parent === 'string' ? parent : undefined
}

/**
 * Whether this call delivers the answer to the caller's own direct parent.
 * Every other call stays denied — including `send_message` aimed at any other
 * agent — so the reply channel cannot be widened into general messaging.
 */
function isReplyToParent(name: string | undefined, args: unknown, agent: AgentIdentity | undefined): boolean {
  if (name !== REPLY_TOOL) return false
  const target = (args as { agent_id?: unknown } | undefined)?.agent_id
  const parent = parentSessionOf(agent)
  return parent !== undefined && typeof target === 'string' && target === parent
}

function descriptorLabel(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('label' in data) || typeof data.label !== 'string') return undefined
  return data.label
}

/** 有 sessionProjections 时读 subagent；没有该服务时才回退同步快照。0.2.0-rc.1 仍有 snapshotEvents。 */
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

/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具，只放行发回父会话的 send_message。 */
export function createAnswerOnlyGuard(labels: ReadonlySet<string>, identityOf?: IdentityOf): AnswerOnlyGuard {
  const owned = new WeakSet<object>()
  const claim = (value: object | undefined) => {
    if (value) owned.add(value)
  }
  const guard: AnswerOnlyGuard = ({ agent, name, arguments: args }) => {
    if (!agent) return undefined
    const verdict = isReplyToParent(name, args, agent) ? undefined : DENY
    const session = agent.session as object | undefined
    if (owned.has(agent) || (session !== undefined && owned.has(session))) return verdict
    const label = lastDescriptorLabel(session, identityOf)
    if (!label || !labels.has(label)) return undefined
    claim(agent)
    claim(session)
    return verdict
  }
  guard.own = agent => { claim(agent) }
  guard.recognize = (session, event) => {
    if (event.type !== 'subagent/descriptor') return
    const label = descriptorLabel(event.data)
    if (label && labels.has(label)) claim(session)
  }
  return guard
}
