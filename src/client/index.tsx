import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { InputTriggerSource, PickOutcome } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { CLOSE_COMMAND, RUN_COMMAND, type SideResult } from '../shared'
import { BubbleStore } from './bubbles'
import { BubbleDock } from './BubbleView'
import { CSS } from './styles'
import { en, zh, NS, normalizeLocale, type BtwTranslate } from '../locales'

export const inject = ['slots', 'inputTriggers', 'remote', 'remote.commands', 'locale']

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
    run: (session, id, question, signal) => execute(session, `/${RUN_COMMAND} ${JSON.stringify({ id, question, locale: normalizeLocale(t('locale.id')) })}`, signal),
    close: (session, id) => execute(session, `/${CLOSE_COMMAND} ${id}`),
  }, t)

  const claim = (sessionId: SessionId): PickOutcome => ({ claim: {
    token: '/btw', get hint() { return t('command.hint') },
    submit: async (args, _actx, images) => {
      if (images.length) return { kind: 'error', text: t('error.images') }
      try {
        await store.ask(sessionId, args.trim())
        return { kind: 'success' }
      } catch (error) { return { kind: 'error', text: error instanceof Error ? error.message : String(error) } }
    },
  } })
  const source: InputTriggerSource = {
    name: 'btw', trigger: '/', order: -100,
    candidates: async (_session, request) => !request.signal.aborted && 'btw'.startsWith(request.query.toLowerCase()) ? [{ name: 'btw', description: t('command.description'), hint: t('command.hint') }] : [],
    onPick: pick => pick.candidate.name === 'btw' ? claim(pick.session.sessionId) : undefined,
    matchSpace: (session, token) => token === '/btw' ? claim(session.sessionId) : undefined,
    matchEnter: async (session, line, signal, envelope) => {
      if (signal.aborted || !/^\/btw(?:\s|$)/.test(line)) return undefined
      if (envelope.images) throw new Error(t('error.removeImages'))
      return claim(session.sessionId)
    },
  }
  ctx.effect(() => {
    let registeredName: string | undefined
    let unregister = () => {}
    // 宿主没有独立的分类标题字段，未知来源名会直接显示；用原生注销机制清理旧分组。
    const register = () => {
      const name = t('menu.group')
      if (name === registeredName) return
      unregister()
      unregister = ctx.inputTriggers.registerSource({ ...source, name })
      registeredName = name
    }
    register()
    const unsubscribe = ctx.locale.subscribe(register)
    return () => { unsubscribe(); unregister() }
  })
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.michengaiBtw = ''
    style.textContent = CSS
    document.head.append(style)
    return () => style.remove()
  })
  ctx.effect(() => () => store.dispose())

  function Dock(props: PropsRuntime<'conversation.input.dock'> & { t: BtwTranslate }): React.JSX.Element {
    return <BubbleDock store={store} sessionId={props.session.sessionId} t={props.t} />
  }
  slots.inject('conversation.input.dock', () => slots.register({ name: 'conversation.input.dock', id: 'michengai-btw', order: -50, locale: NS }, Dock))
  slots.inject('conversation.chat.commandview', () => {
    const off = [RUN_COMMAND, CLOSE_COMMAND].map(key => slots.register({ name: 'conversation.chat.commandview', key }, () => null))
    return () => off.forEach(dispose => dispose())
  })
}
