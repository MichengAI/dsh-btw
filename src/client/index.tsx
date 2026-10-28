import React from 'react'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { PickOutcome } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { MessageCircle } from 'lucide-react'
import { CLOSE_COMMAND, RUN_COMMAND, type SideResult } from '../shared'
import { BubbleStore, SideRequestNotStartedError } from './bubbles'
import { BubbleDock } from './BubbleView'
import { QuoteStore } from './quotes'
import { SelectionAsk } from './SelectionAsk'
import { CSS } from './styles'
import { createQuoteTriggerSource } from './trigger-source'
import { quoteUserTextRule, QuoteUserTextNode } from './user-quote-chip'
import { en, zh, NS, normalizeLocale, type BtwTranslate } from '../locales'
import { BtwSettingsCard, type BtwSettingsFace } from './SettingsCard'
import { createSettingsScope, BUNDLE_NAME, ROW_CONFIG_KEY, type BtwSettingsScope, type HostConfigForms } from './settings-scope'

export const inject = ['slots', 'remote', 'remote.commands', 'locale', 'conversation', 'sessions']

function BtwCommandIcon({ size = 16, className }: { size?: number; className?: string }): React.JSX.Element {
  return <MessageCircle size={size} className={className} />
}

function sessionIdOf(session: unknown): string {
  if (typeof session === 'string') return session
  if (session && typeof session === 'object' && 'sessionId' in session) return String((session as { sessionId: unknown }).sessionId)
  return String(session)
}

type LiveCommandUi = {
  candidates?: (...args: unknown[]) => unknown
  dispatch?: (pick: { candidate?: { name?: string }; session?: unknown; span?: unknown }) => unknown
  matchSpace?: (session: unknown, token: string) => unknown
  matchEnter?: (session: unknown, line: string, signal: AbortSignal, envelope: { attachments?: number; images?: number }) => unknown
  execute?: (session: unknown, line: string, attachments?: unknown) => unknown
}

/** 官方认领闭包在 commandUi 上；改 remote.commands 拦不到真实提交。 */
function attachOfficialBtw(commandUi: unknown, claim: (sessionId: string) => PickOutcome, t: BtwTranslate, isSubagent: (sessionId: string) => boolean): () => void {
  const live = commandUi as LiveCommandUi | undefined
  if (!live) return () => {}
  const restore: Array<() => void> = []

  if (typeof live.candidates === 'function') {
    const original = live.candidates
    live.candidates = async (...args: unknown[]) => {
      const rows = await original.apply(live, args)
      if (!Array.isArray(rows)) return rows
      return rows.filter((row: unknown) => !(isSubagent(sessionIdOf(args[0])) && row && typeof row === 'object' && 'name' in row && row.name === 'btw')).map((row: unknown) => {
        if (!row || typeof row !== 'object' || !('name' in row) || (row as { name: unknown }).name !== 'btw') return row
        const item = row as { name: string; icon?: unknown }
        return {
          ...item,
          label: t('command.label'),
          description: t('command.description'),
          hint: t('command.hint'),
          icon: item.icon ?? BtwCommandIcon,
        }
      })
    }
    restore.push(() => { live.candidates = original })
  }

  if (typeof live.dispatch === 'function') {
    const original = live.dispatch.bind(live)
    live.dispatch = pick => pick.candidate?.name === 'btw' ? (isSubagent(sessionIdOf(pick.session)) ? undefined : claim(sessionIdOf(pick.session))) : original(pick)
    restore.push(() => { live.dispatch = original })
  }

  if (typeof live.matchSpace === 'function') {
    const original = live.matchSpace.bind(live)
    live.matchSpace = (session, token) => token === '/btw' ? (isSubagent(sessionIdOf(session)) ? undefined : claim(sessionIdOf(session))) : original(session, token)
    restore.push(() => { live.matchSpace = original })
  }

  if (typeof live.matchEnter === 'function') {
    const original = live.matchEnter.bind(live)
    live.matchEnter = async (session, line, signal, envelope) => {
      if (!/^\/btw(?:\s|$)/.test(line.trim())) return original(session, line, signal, envelope)
      if (isSubagent(sessionIdOf(session))) throw new Error(t('error.subagent'))
      if (envelope?.attachments || envelope?.images) throw new Error(t('error.removeAttachments'))
      return claim(sessionIdOf(session))
    }
    restore.push(() => { live.matchEnter = original })
  }

  if (typeof live.execute === 'function') {
    const original = live.execute.bind(live)
    live.execute = async (session, line, attachments) => {
      if (!/^\/btw(?:\s|$)/.test(line)) return original(session, line, attachments)
      if (isSubagent(sessionIdOf(session))) return { kind: 'error', text: t('error.subagent') }
      if (Array.isArray(attachments) && attachments.length) return { kind: 'error', text: t('error.attachments') }
      const outcome = claim(sessionIdOf(session))
      if (!outcome || typeof outcome !== 'object' || !('claim' in outcome)) return { kind: 'error', text: t('error.backend') }
      try {
        return await outcome.claim.submit(line.replace(/^\/btw\s*/, '').trim(), undefined as never, [])
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      }
    }
    restore.push(() => { live.execute = original })
  }

  return () => restore.forEach(dispose => dispose())
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS)
  const slots = ctx.get('slots') as SlotRegistry
  const remote = ctx.get('remote') as TypertClientRemote
  const sessions = ctx.get('sessions') as unknown as ISessions
  // 普通分叉也有父会话；只使用宿主明确给出的子代理身份，不按 parentId 猜测。
  const isSubagent = (id: string): boolean => Boolean(sessions.subagentAddress?.(id as SessionId)) || sessions.list?.getSnapshot().byId[id as SessionId]?.origin === 'subagent'
  const execute = async (session: string, line: string, signal?: AbortSignal): Promise<SideResult> => {
    const response = await remote.commands.execute(session as SessionId, line, [], signal)
    if (!response.ok) {
      const failure = response.error
      const code: string = failure.code
      const details = failure.details
      const reason = details && typeof details === 'object' && 'reason' in details && typeof details.reason === 'string' ? details.reason : undefined
      const ownedBySubagent = (code === 'agent-busy' || code === 'session/agent-busy')
        && (reason === 'use subagent delivery for this child session' || failure.message === `session "${session}" is owned by subagent routing`)
      if (ownedBySubagent) throw new SideRequestNotStartedError(t('error.subagent'))
      throw new Error(failure.message)
    }
    if (!response.value) throw new Error(t('error.backend'))
    return { kind: response.value.result.kind, text: response.value.result.text ?? '' }
  }
  const store = new BubbleStore({
    run: (session, id, question, signal, reference) => execute(session, `/${RUN_COMMAND} ${JSON.stringify({ id, question, reference, locale: normalizeLocale(t('locale.id')) })}`, signal),
    close: (session, id) => execute(session, `/${CLOSE_COMMAND} ${id}`),
  }, t)
  const quoteStore = new QuoteStore()

  const claim = (sessionId: SessionId): PickOutcome => ({ claim: {
    name: 'btw', token: '/btw ', get hint() { return t('command.hint') },
    submit: async (args, _actx, attachments) => {
      if (isSubagent(sessionId)) return { kind: 'error', text: t('error.subagent') }
      if (attachments.length) return { kind: 'error', text: t('error.attachments') }
      try {
        await store.ask(sessionId, args.trim())
        return { kind: 'success' }
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : String(error) } }
    },
  } })
  const registerTriggerSource = (inputTriggers: unknown) => {
    const it = inputTriggers as { registerSource?: (src: unknown) => () => void } | undefined
    if (it && typeof it.registerSource === 'function') {
      return it.registerSource(createQuoteTriggerSource({ quoteStore, t }))
    }
    return undefined
  }

  const registerUserTextRule = (uiConversation: unknown) => {
    const uc = uiConversation as { userText?: { register?: (rule: unknown) => () => void } } | undefined
    if (uc?.userText && typeof uc.userText.register === 'function') {
      return uc.userText.register(quoteUserTextRule)
    }
    return undefined
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['commandUi'], scope => attachOfficialBtw(scope.get('commandUi'), sessionId => claim(sessionId as SessionId), t, isSubagent))
    ctx.inject(['inputTriggers'], scope => {
      const off = registerTriggerSource(scope.get('inputTriggers'))
      if (typeof off === 'function') scope.effect(() => off)
    })
    ctx.inject(['uiConversation'], scope => {
      const off = registerUserTextRule(scope.get('uiConversation'))
      if (typeof off === 'function') scope.effect(() => off)
    })
  } else {
    ctx.effect(() => attachOfficialBtw(ctx.get('commandUi'), sessionId => claim(sessionId as SessionId), t, isSubagent))
    const offTrigger = registerTriggerSource(ctx.get('inputTriggers'))
    if (typeof offTrigger === 'function') ctx.effect(() => offTrigger)
    const offRule = registerUserTextRule(ctx.get('uiConversation'))
    if (typeof offRule === 'function') ctx.effect(() => offRule)
  }

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@michengai/dsh-btw'
    style.dataset.pluginCss = '@michengai/dsh-btw/client.css'
    style.dataset.michengaiBtw = ''
    style.textContent = CSS
    ;(document.head ?? document.documentElement).append(style)
    return () => style.remove()
  })
  ctx.effect(() => () => store.dispose())

  function Dock(props: PropsRuntime<'conversation.input.dock'> & { t: BtwTranslate }): React.JSX.Element {
    const session = (ctx.get('sessions') as unknown as ISessions).scope(props.session.sessionId)
    return <>{!props.session.subagent && !isSubagent(props.session.sessionId) && <SelectionAsk key={props.session.sessionId} store={store} quoteStore={quoteStore} sessionId={props.session.sessionId} t={props.t} input={session ? ctx.conversation.input.for(session) : undefined} />}<BubbleDock store={store} sessionId={props.session.sessionId} t={props.t} /></>
  }
  slots.inject('conversation.input.dock', () => slots.register({ name: 'conversation.input.dock', id: 'michengai-btw', order: -50, locale: NS }, Dock))
  slots.inject('conversation.user.text.node', () => slots.register({
    name: 'conversation.user.text.node',
    key: 'dsh-btw-quote',
    priority: 100,
    locale: NS,
  }, QuoteUserTextNode as any))
  slots.inject('conversation.chat.commandview', () => {
    const off = [RUN_COMMAND, CLOSE_COMMAND].map(key => slots.register({ name: 'conversation.chat.commandview', key }, () => null))
    return () => off.forEach(dispose => dispose())
  })

  // 设置卡片挂在宿主 Plugins 页的配置槽里，位置与 `dsh-subagent-default-model` 完全一致。
  // `configForms` 是宿主 0.1.7+ 的客户端设置面；用软注入，宿主没有它时卡片直接不出现，
  // 不能让整个客户端插件因为少了这个服务而激活失败。
  ctx.inject(['configForms'], scope => {
    const forms = scope.get('configForms') as HostConfigForms | undefined
    if (!forms) return
    const settingsScope: BtwSettingsScope = createSettingsScope(forms)
    const face: BtwSettingsFace = { scope: settingsScope }
    // 这两个槽的 SlotMap 契约由宿主 plugin-manager 包声明，btw 不依赖它，
    // 因此按结构化形状注册：宿主有该槽时才渲染，没有时 register 只是空转。
    const loose = slots as unknown as {
      inject(name: string, callback: () => () => void): () => void
      register(options: { name: string; key: string; priority: number; locale: string; inject?: () => object }, component: unknown): () => void
    }
    // 两个槽都要注册，缺一个用户就找不到入口：
    //   · `plugins.bundle.config` —— 插件详情页里那块显眼的配置区（key = 包名）。
    //   · `plugins.row.config`    —— 「组成部分」列表里那一行的小箭头（key = `<包名>#<行 id>`）。
    // 只注册行级槽时，详情页没有任何配置区，用户必须先展开列表才看得到一个箭头按钮。
    const cards: { name: string; key: string }[] = [
      { name: 'plugins.bundle.config', key: BUNDLE_NAME },
      { name: 'plugins.row.config', key: ROW_CONFIG_KEY },
    ]
    for (const card of cards) {
      scope.effect(() => loose.inject(card.name, () => loose.register({
        name: card.name,
        key: card.key,
        priority: 30,
        locale: NS,
        inject: () => face,
      }, (props: { t: BtwTranslate }) => <BtwSettingsCard t={props.t as never} scope={face.scope} />)))
    }
  })
}
