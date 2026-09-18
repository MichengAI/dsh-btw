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
import { BubbleStore } from './bubbles'
import { BubbleDock } from './BubbleView'
import { addQuoteToComposer } from './composer'
import { SelectionAsk } from './SelectionAsk'
import { CSS } from './styles'
import { en, zh, NS, normalizeLocale, type BtwTranslate } from '../locales'

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
function attachOfficialBtw(commandUi: unknown, claim: (sessionId: string) => PickOutcome, t: BtwTranslate): () => void {
  const live = commandUi as LiveCommandUi | undefined
  if (!live) return () => {}
  const restore: Array<() => void> = []

  if (typeof live.candidates === 'function') {
    const original = live.candidates
    live.candidates = async (...args: unknown[]) => {
      const rows = await original.apply(live, args)
      if (!Array.isArray(rows)) return rows
      return rows.map((row: unknown) => {
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
    live.dispatch = pick => pick.candidate?.name === 'btw' ? claim(sessionIdOf(pick.session)) : original(pick)
    restore.push(() => { live.dispatch = original })
  }

  if (typeof live.matchSpace === 'function') {
    const original = live.matchSpace.bind(live)
    live.matchSpace = (session, token) => token === '/btw' ? claim(sessionIdOf(session)) : original(session, token)
    restore.push(() => { live.matchSpace = original })
  }

  if (typeof live.matchEnter === 'function') {
    const original = live.matchEnter.bind(live)
    live.matchEnter = async (session, line, signal, envelope) => {
      if (!/^\/btw(?:\s|$)/.test(line.trim())) return original(session, line, signal, envelope)
      if (envelope?.attachments || envelope?.images) throw new Error(t('error.removeAttachments'))
      return claim(sessionIdOf(session))
    }
    restore.push(() => { live.matchEnter = original })
  }

  if (typeof live.execute === 'function') {
    const original = live.execute.bind(live)
    live.execute = async (session, line, attachments) => {
      if (!/^\/btw(?:\s|$)/.test(line)) return original(session, line, attachments)
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
  const execute = async (session: string, line: string, signal?: AbortSignal): Promise<SideResult> => {
    const response = await remote.commands.execute(session as SessionId, line, [], signal)
    if (!response.ok) throw new Error(response.error.message)
    if (!response.value) throw new Error(t('error.backend'))
    return { kind: response.value.result.kind, text: response.value.result.text ?? '' }
  }
  const store = new BubbleStore({
    run: (session, id, question, signal, reference) => execute(session, `/${RUN_COMMAND} ${JSON.stringify({ id, question, reference, locale: normalizeLocale(t('locale.id')) })}`, signal),
    close: (session, id) => execute(session, `/${CLOSE_COMMAND} ${id}`),
  }, t)

  const claim = (sessionId: SessionId): PickOutcome => ({ claim: {
    name: 'btw', token: '/btw', get hint() { return t('command.hint') },
    submit: async (args, _actx, attachments) => {
      if (attachments.length) return { kind: 'error', text: t('error.attachments') }
      try {
        await store.ask(sessionId, args.trim())
        return { kind: 'success' }
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : String(error) } }
    },
  } })
  if (typeof ctx.inject === 'function') ctx.inject(['commandUi'], scope => attachOfficialBtw(scope.get('commandUi'), sessionId => claim(sessionId as SessionId), t))
  else ctx.effect(() => attachOfficialBtw(ctx.get('commandUi'), sessionId => claim(sessionId as SessionId), t))

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.michengaiBtw = ''
    style.textContent = CSS
    document.head.append(style)
    return () => style.remove()
  })
  ctx.effect(() => () => store.dispose())

  function Dock(props: PropsRuntime<'conversation.input.dock'> & { t: BtwTranslate }): React.JSX.Element {
    return <><SelectionAsk key={props.session.sessionId} store={store} sessionId={props.session.sessionId} t={props.t} addToConversation={reference => {
      const session = (ctx.get('sessions') as unknown as ISessions).scope(props.session.sessionId)
      if (!session) throw new Error(props.t('error.backend'))
      addQuoteToComposer(ctx.conversation.input.for(session), reference, props.t)
    }} /><BubbleDock store={store} sessionId={props.session.sessionId} t={props.t} /></>
  }
  slots.inject('conversation.input.dock', () => slots.register({ name: 'conversation.input.dock', id: 'michengai-btw', order: -50, locale: NS }, Dock))
  slots.inject('conversation.chat.commandview', () => {
    const off = [RUN_COMMAND, CLOSE_COMMAND].map(key => slots.register({ name: 'conversation.chat.commandview', key }, () => null))
    return () => off.forEach(dispose => dispose())
  })
}
