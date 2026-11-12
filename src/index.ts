import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-subagent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import { CLOSE_COMMAND, MAX_QUESTION_LENGTH, parseRequest, questionWithReference, RUN_COMMAND } from './shared'
import { SIDE_MAX_OUTPUT_TOKENS } from './limits'
import { DEFAULT_TIMEOUT_MS, SideJobs } from './server/jobs'
import {
  createAnswerOnlyGuard,
  identityOfFromContext,
  parentNameOfFromContext,
  type SubagentMemberNamesLike,
} from './server/tool-guard'
import { readSettings } from './server/settings'
import { translate } from './locales'
import { hideInternalCommands } from './server/command-visibility'

export const name = 'michengai-btw'
export const inject = ['commands', 'subagents', 'tools']
export { Config } from './server/settings'

interface GuardedAgent {
  ctx?: {
    tools: {
      guard(guard: ReturnType<typeof createAnswerOnlyGuard>): () => void | Promise<void>
    }
  }
}

/** 宿主命令只负责接入与身份绑定，不创建 HTTP 或持久侧聊接口。 */
export function apply(ctx: Context, config?: unknown): void {
  ctx.effect(() => hideInternalCommands(ctx.commands))
  const labels = new Set<string>()
  // 配置每读一次都重新解包：设置面板改完立即对下一次旁问生效，不需要重载插件。
  const settingsNow = () => readSettings(config)
  // 保护挂在子代理自己的上下文上，随子代理释放，不借用宿主根 fiber。
  // dsh-tui 会拒绝插件激活期间的 root.effect / root.events。
  const protection = createAnswerOnlyGuard(
    labels,
    identityOfFromContext(ctx),
    () => settingsNow().allowedTools,
    parentNameOfFromContext(ctx),
  )
  const releasePluginGuard = ctx.tools.guard(protection)
  const childGuards = new WeakMap<object, () => void | Promise<void>>()
  const arm = (agent: GuardedAgent) => {
    // child 级 guard 只是纵深防御：确定性拦截已由 ownId 预登记承担（agent.id === childId），
    // 因此 agent.ctx 尚未就绪时静默跳过不影响拦截能力；不要往这里加唯一的必要限制。
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
    const parentAgent = request.context as Agent | undefined
    const parentId = parentAgent?.session?.header?.id
    const subagents = ctx.subagents as unknown as {
      rootOf?: (caller: Agent) => Agent
      namesOf?: (agent: Agent) => SubagentMemberNamesLike | undefined
      startActivation?: (spec:
        | {
          provider: string
          label: string
          childId: ReturnType<typeof SessionId>
          parent: Agent
          prompt: readonly { type: string; text: string }[]
          agentOptions?: { maxTokens?: number }
          signal: AbortSignal
          delivery: 'caller'
        }
        | {
          provider: string
          label: string
          childId: ReturnType<typeof SessionId>
          request: { parent: Agent; prompt: readonly { type: string; text: string }[]; agentOptions?: { maxTokens?: number } }
          signal: AbortSignal
          delivery: 'caller'
        }
      ) => Promise<{ result: Promise<{ stopReason: string; output: readonly { type: string; text?: string }[] }>; dispose(): Promise<void> }>
      start?: (provider: string, options: {
        parent: Agent
        label: string
        signal: AbortSignal
        agentOptions?: { maxTokens?: number }
        prompt: readonly { type: string; text: string }[]
      }) => Promise<{ result: Promise<{ stopReason: string; output: readonly { type: string; text?: string }[] }>; localAgent?: object; dispose(): Promise<void> }>
    }
    // DSH 0.2.2-rc.2 扁平激活契约探测依据：
    // 官方在 0.2.2-rc.2 随 subagent 协作树与命名机制重构，将 startActivation 的 spec 改为扁平结构并移除了 spec.request。
    // 在已验证宿主矩阵中，rootOf 与扁平 spec 均且仅在 0.2.2-rc.2+ 同时出现，故以 rootOf 作为扁平启动的代际分流依据。
    const isFlatActivation = typeof subagents.rootOf === 'function'

    // 回传参数字段判定：
    // 优先通过当前宿主中实际注册的 send_message 工具参数定义动态识别目标参数字段名（'agent' 或 'agent_id'）；
    // 若工具定义不可读取，则按当前宿主代际（isFlatActivation）安全回退默认字段名。
    let replyField: 'agent' | 'agent_id' = isFlatActivation ? 'agent' : 'agent_id'
    try {
      const sendTool = (ctx.tools as unknown as {
        get?(name: string, agent?: Agent): { parameters?: { properties?: Record<string, unknown> } } | undefined
      }).get?.('send_message', parentAgent)
      const props = sendTool?.parameters?.properties
      if (props && typeof props === 'object') {
        if ('agent' in props && !('agent_id' in props)) replyField = 'agent'
        else if ('agent_id' in props) replyField = 'agent_id'
      }
    } catch {
      // 保留基于 subagents 能力探测的默认字段名
    }
    // replyTarget 判定：
    // 当字段为 'agent' 时，优先使用 parentAgent 在协作树中的模型侧名称（如 'lead' 或路径别名）以便与模型提示词规范严格对齐；
    // 若名称未声明，也可安全保留父会话 ID（宿主 resolveName 机制将单一 token 直接作为 SessionId 解析）。
    let replyTarget: string | undefined = parentId
    if (parentId !== undefined && replyField === 'agent' && parentAgent) {
      let resolvedName: string | undefined
      if (typeof subagents.namesOf === 'function') {
        try {
          const self = subagents.namesOf(parentAgent)?.self
          if (typeof self === 'string' && self.length > 0) resolvedName = self
        } catch {}
      }
      if (resolvedName === undefined && typeof subagents.rootOf === 'function') {
        try {
          if (subagents.rootOf(parentAgent) === parentAgent) resolvedName = 'lead'
        } catch {}
      }
      if (resolvedName !== undefined) replyTarget = resolvedName
    }
    const settings = settingsNow()
    const replyHint = replyTarget === undefined
      ? ''
      : `\n\n${t('agent.replyHint', { field: replyField, parent: JSON.stringify(replyTarget) })}`
    // 自定义提示词替换内置前缀；工具权限句始终追加，配置不能让模型误以为「什么都能调」。
    const permissions = settings.allowedTools.length === 0 ? '' : `\n\n${t('agent.toolsAllowed', { tools: settings.allowedTools.join(', ') })}`
    const prefix = settings.promptPrefix === '' ? t('agent.promptPrefix') : settings.promptPrefix
    const promptText = `${prefix}${permissions}${replyHint}\n\n${request.question}`
    const parentMaxTokens = parentAgent?.options?.maxTokens
    const maxTokens = typeof parentMaxTokens === 'number' && parentMaxTokens > 0
      ? Math.min(SIDE_MAX_OUTPUT_TOKENS, parentMaxTokens)
      : SIDE_MAX_OUTPUT_TOKENS
    if (typeof subagents.startActivation === 'function') {
      const childId = SessionId(globalThis.crypto.randomUUID())
      const releaseChildId = protection.ownId(childId)
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
          // 0.2.2-rc.2+（存在 rootOf）使用扁平 SubagentActivationSpec；0.2.1-rc.1 ~ 0.2.2-rc.1 仍包装在 request 内。
          activation = await subagents.startActivation(
            isFlatActivation
              ? {
                provider: 'fork',
                label,
                childId,
                parent: request.context as Agent,
                // 旁问只需一次性只读回答：收紧继承来的过大输出预算，避免长会话溢出；
                // 同时取 min 避免反向抬高小预算路由。
                agentOptions: { maxTokens },
                prompt: [{ type: 'text', text: promptText }],
                signal: request.signal,
                delivery: 'caller',
              }
              : {
                provider: 'fork',
                label,
                childId,
                request: {
                  parent: request.context as Agent,
                  agentOptions: { maxTokens },
                  prompt: [{ type: 'text', text: promptText }],
                },
                signal: request.signal,
                delivery: 'caller',
              },
          )
        } finally {
          stopCreated()
        }
        // 结果落地即释放预登记 id：dispose 可能因 cleanup 超时未被调用，
        // 释放放在两处（此处与 dispose）保证 ownedIds 不会只增不减；重复释放无副作用。
        void activation.result.then(() => releaseChildId(), () => releaseChildId())
        return {
          result: activation.result,
          dispose: async () => {
            try { await activation.dispose() }
            finally {
              try { await releaseChild(childAgent) }
              finally { releaseChildId(); releaseLabel(label) }
            }
          },
        }
      } catch (error) {
        releaseChildId()
        releaseLabel(label)
        throw error
      }
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
        agentOptions: { maxTokens },
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
