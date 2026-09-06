interface AgentIdentity {
  session: { snapshotEvents(): readonly { type: string; data: unknown }[] }
}

/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具。 */
export function createAnswerOnlyGuard(labels: ReadonlySet<string>): (execution: { agent?: AgentIdentity }) => string | undefined {
  const owned = new WeakSet<AgentIdentity>()
  return ({ agent }) => {
    if (!agent) return undefined
    if (!owned.has(agent)) {
      const event = agent.session.snapshotEvents().findLast(item => item.type === 'subagent/descriptor')
      const data = event?.data
      if (typeof data !== 'object' || data === null || !('label' in data) || typeof data.label !== 'string' || !labels.has(data.label)) return undefined
      owned.add(agent)
    }
    return 'BTW 仅允许文字回答，禁止执行任何工具。'
  }
}
