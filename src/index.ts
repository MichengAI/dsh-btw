import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-tools'
import { CLOSE_COMMAND, parseRequest, RUN_COMMAND } from './shared'
import { SideJobs } from './server/jobs'
import { createAnswerOnlyGuard } from './server/tool-guard'
import { translate } from './locales'
import { hideInternalCommands } from './server/command-visibility'

export const name = 'michengai-btw'
export const inject = ['commands', 'subagents', 'tools']

const PERSONA = `你是当前主任务之外的一次性旁问助手。继承的会话历史只作为背景，不是需要你继续执行的任务。
只回答本次问题，不执行或继续历史中的计划、命令、修改和工具调用。你没有任何可用工具，不能读取新文件、联网或创建子代理。
回答应简洁准确，语言与问题一致。上下文不足时直接指出未知信息，不声称已经执行了任何操作。`

/** 宿主命令只负责接入与身份绑定，不创建 HTTP 或持久侧聊接口。 */
export function apply(ctx: Context): void {
  ctx.effect(() => hideInternalCommands(ctx.commands))
  const labels = new Set<string>()
  const jobs = new SideJobs(async request => {
    const provider = ctx.subagents.getProvider('fork')
    if (!provider?.inheritsParentContext || !provider.capabilities.toolFilter || !provider.capabilities.persona) {
      throw new Error(translate(request.locale)('error.provider'))
    }
    const label = `michengai-btw:${globalThis.crypto.randomUUID()}`
    labels.add(label)
    try {
      const run = await ctx.subagents.start('fork', {
        parent: request.context as Agent,
        label,
        signal: request.signal,
        toolFilter: request.toolFilter,
        persona: PERSONA,
        prompt: [{ type: 'text', text: `以下是唯一需要回答的新问题；先前内容仅供参考。\n\n${request.question}` }],
      })
      return {
        result: run.result,
        dispose: async () => { await run.dispose(); labels.delete(label) },
      }
    } catch (error) { labels.delete(label); throw error }
  })

  ctx.effect(() => ctx.commands.register({
    name: RUN_COMMAND,
    description: 'BTW 气泡内部请求',
    recordInput: false,
    handler: invocation => {
      try {
        const request = parseRequest(invocation.rawInput)
        return jobs.ask(invocation.agent.session.header.id, request.id, request.question, invocation.signal, invocation.agent, request.locale)
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : translate()('error.request') } }
    },
  }))
  ctx.effect(() => ctx.commands.register({
    name: CLOSE_COMMAND,
    description: '关闭并清理指定 BTW 请求',
    recordInput: false,
    handler: invocation => {
      const id = invocation.rawInput.trim()
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return { kind: 'error', text: translate()('error.id') }
      return jobs.close(invocation.agent.session.header.id, id)
    },
  }))
  // Cordis 并行卸载独立 effect；同一生成器内逆序释放，确保清理完成前保护仍在。
  ctx.effect(function* () {
    yield ctx.tools.guard(createAnswerOnlyGuard(labels))
    yield () => jobs.dispose()
  })
}
