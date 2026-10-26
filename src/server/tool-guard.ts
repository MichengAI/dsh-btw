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
  (execution: { agent?: AgentIdentity; name?: string; arguments?: unknown }): string | undefined
  own(agent: object): void
  ownId(id: string): () => void
  recognize(session: object, event: SessionEventLike): void
}

const DENY = 'BTW 仅允许文字回答，禁止执行任何工具。 / BTW allows text responses only; tool execution is strictly prohibited.'

/**
 * 唯一放行的继承工具，且只能发给自己的父会话。复用宿主的 `send_message`
 * 而不是新注册工具，才能保持旁问请求的工具列表与主会话逐字节一致
 * （`tests/cache-prefix.test.ts` 的 prompt cache 复用护栏）。
 */
export const REPLY_TOOL = 'send_message'

/** 本次旁问所属父会话的 id；没有父会话时不存在回传通道。 */
export function parentSessionOf(agent: AgentIdentity | undefined): string | undefined {
  const parent = (agent?.session as { header?: { parentSession?: unknown } } | undefined)?.header?.parentSession
  return typeof parent === 'string' ? parent : undefined
}

/** 仅当工具是 `send_message` 且目标严格等于父会话 id 时放行，其余一律拒绝。 */
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

/** 有 sessionProjections 时优先读 subagent；投影未返回合法标签时回退同步快照。0.2.0-rc.1 仍有 snapshotEvents。 */
function lastDescriptorLabel(session: object | undefined, identityOf?: IdentityOf): string | undefined {
  if (!session) return undefined
  if (identityOf) {
    const identity = identityOf(session)
    if (typeof identity?.label === 'string') return identity.label
  }
  const events = (session as SessionIdentityHint).snapshotEvents
  if (typeof events !== 'function') return undefined
  // 回退路径对每个「投影为 null」的会话都会执行（含主会话每次工具调用）：
  // 快照读取抛错时按既有 fail-open 语义放行，不让异常冒进工具执行链。
  try { return descriptorLabel(events().findLast(item => item.type === 'subagent/descriptor')?.data) }
  catch { return undefined }
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

  const guard: AnswerOnlyGuard = ({ agent, name, arguments: args }) => {
    if (!agent) return undefined
    // 唯一放行：把答案发回自己的父会话。其余工具、以及发给其它 agent 的 send_message 一律拒绝。
    // 三条认领路径（预登记 id / 已认领对象 / 投影或快照 label）都必须返回 verdict，
    // 否则 isOwnedId 先短路会让回传通道在生产主路径上失效。
    const verdict = isReplyToParent(name, args, agent) ? undefined : DENY
    if (isOwnedId(agent)) return verdict
    if (owned.has(agent) || (agent.session !== undefined && owned.has(agent.session))) return verdict
    const label = lastDescriptorLabel(agent.session, identityOf)
    if (!label || !labels.has(label)) return undefined
    claimAgent(agent)
    return verdict
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
