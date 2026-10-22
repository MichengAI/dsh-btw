import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-subagent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import { CLOSE_COMMAND, MAX_QUESTION_LENGTH, parseRequest, questionWithReference, RUN_COMMAND } from './shared'
import { DEFAULT_TIMEOUT_MS, SideJobs } from './server/jobs'
import { createAnswerOnlyGuard, identityOfFromContext } from './server/tool-guard'
import { translate } from './locales'
import { hideInternalCommands } from './server/command-visibility'

export const name = 'michengai-btw'
export const inject = ['commands', 'subagents', 'tools']

interface GuardedAgent {
  ctx?: {
    tools: {
      guard(guard: ReturnType<typeof createAnswerOnlyGuard>): () => void | Promise<void>
    }
  }
}

/** 宿主命令只负责接入与身份绑定，不创建 HTTP 或持久侧聊接口。 */
export function apply(ctx: Context): void {
  ctx.effect(() => hideInternalCommands(ctx.commands))
  const labels = new Set<string>()
  // 保护挂在子代理自己的上下文上，随子代理释放，不借用宿主根 fiber。
  // dsh-tui 会拒绝插件激活期间的 root.effect / root.events。
  const protection = createAnswerOnlyGuard(labels, identityOfFromContext(ctx))
  const releasePluginGuard = ctx.tools.guard(protection)
  const childGuards = new WeakMap<object, () => void | Promise<void>>()
  const arm = (agent: GuardedAgent) => {
    protection.own(agent)
    if (!agent.ctx || childGuards.has(agent)) return
    childGuards.set(agent, agent.ctx.tools.guard(protection))
  }
  const releaseChild = async (agent: object | undefined) => {
    if (!agent) return
    const release = childGuards.get(agent)
    childGuards.delete(agent)
    await release?.()
  }
  const stopWatch = ctx.on('session/event', (session, event) => protection.recognize(session, event))
  const activeLabels = new Map<string, number>()
  const retainLabel = (l: string) => {
    activeLabels.set(l, (activeLabels.get(l) ?? 0) + 1)
    labels.add(l)
  }
  const releaseLabel = (l: string) => {
    const count = (activeLabels.get(l) ?? 1) - 1
    if (count <= 0) {
      activeLabels.delete(l)
      labels.delete(l)
    } else {
      activeLabels.set(l, count)
    }
  }

  const jobs = new SideJobs(async request => {
    // 0.2.1-rc.1 起只有 startActivation；0.2.0-rc.1 与 0.2.0-rc.2 仍只有 start。
    const provider = ctx.subagents.getProvider('fork')
    const t = translate(request.locale)
    if (!provider?.inheritsParentContext) {
      throw new Error(t('error.provider'))
    }
    const label = t('agent.name')
    retainLabel(label)
    const promptText = `${t('agent.promptPrefix')}\n\n${request.question}`
    const subagents = ctx.subagents as unknown as {
      startActivation?: (spec: {
        provider: string
        label: string
        childId: ReturnType<typeof SessionId>
        request: { parent: Agent; prompt: readonly { type: string; text: string }[] }
        signal: AbortSignal
        delivery: 'caller'
      }) => Promise<{ result: Promise<{ stopReason: string; output: readonly { type: string; text?: string }[] }>; dispose(): Promise<void> }>
      start?: (provider: string, options: {
        parent: Agent
        label: string
        signal: AbortSignal
        prompt: readonly { type: string; text: string }[]
      }) => Promise<{ result: Promise<{ stopReason: string; output: readonly { type: string; text?: string }[] }>; localAgent?: object; dispose(): Promise<void> }>
    }
    if (typeof subagents.startActivation === 'function') {
      const childId = SessionId(globalThis.crypto.randomUUID())
      let childAgent: object | undefined
      try {
        const stopCreated = ctx.on('agent/created', ({ agent }) => {
          if (agent.id !== childId) return undefined
          childAgent = agent
          // 只挂执行期拦截，不改系统提示、不过滤工具定义：请求前缀与主会话逐字节一致，
          // 才能复用主会话的 prompt cache（与 Claude Code /btw 一致）。
          arm(agent as GuardedAgent)
          return undefined
        })
        let activation
        try {
          activation = await subagents.startActivation({
            provider: 'fork',
            label,
            childId,
            request: {
              parent: request.context as Agent,
              prompt: [{ type: 'text', text: promptText }],
            },
            signal: request.signal,
            delivery: 'caller',
          })
        } finally {
          stopCreated()
        }
        return {
          result: activation.result,
          dispose: async () => {
            try { await activation.dispose() }
            finally { await releaseChild(childAgent); releaseLabel(label) }
          },
        }
      } catch (error) { releaseLabel(label); throw error }
    }
    if (typeof subagents.start !== 'function') {
      releaseLabel(label)
      throw new Error(t('error.provider'))
    }
    try {
      // 不传 persona / toolFilter，理由同上；工具由 AnswerOnlyGuard 在执行期拒绝。
      const run = await subagents.start('fork', {
        parent: request.context as Agent,
        label,
        signal: request.signal,
        prompt: [{ type: 'text', text: promptText }],
      })
      if (run.localAgent) arm(run.localAgent)
      return {
        result: run.result,
        dispose: async () => {
          try { await run.dispose() }
          finally { await releaseChild(run.localAgent); releaseLabel(label) }
        },
      }
    } catch (error) { releaseLabel(label); throw error }
  }, DEFAULT_TIMEOUT_MS, {
    onError: error => ctx.logger.warn(error),
    onIdle: async () => { stopWatch(); await releasePluginGuard() },
  })
  ctx.effect(() => () => jobs.dispose())

  ctx.effect(() => ctx.commands.register({
    name: 'btw',
    description: translate()('command.description'),
    input: { hint: translate()('command.hint') },
    recordInput: false,
    handler: invocation => {
      const question = invocation.rawInput.trim()
      if (!question) return { kind: 'error', text: translate()('error.empty') }
      if (question.length > MAX_QUESTION_LENGTH) return { kind: 'error', text: translate()('error.length') }
      return jobs.ask(invocation.agent.session.header.id, globalThis.crypto.randomUUID(), question, invocation.signal, invocation.agent)
    },
  }))
  ctx.effect(() => ctx.commands.register({
    name: RUN_COMMAND,
    description: translate()('command.internalRun'),
    recordInput: false,
    handler: invocation => {
      try {
        const request = parseRequest(invocation.rawInput)
        return jobs.ask(invocation.agent.session.header.id, request.id, questionWithReference(request.question, request.reference, request.locale), invocation.signal, invocation.agent, request.locale)
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : translate()('error.request') } }
    },
  }))
  ctx.effect(() => ctx.commands.register({
    name: CLOSE_COMMAND,
    description: translate()('command.internalClose'),
    recordInput: false,
    handler: invocation => {
      const id = invocation.rawInput.trim()
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return { kind: 'error', text: translate()('error.id') }
      return jobs.close(invocation.agent.session.header.id, id)
    },
  }))
}
