import React, { useEffect } from 'react'
import type { BtwTranslate } from '../locales'

type OpenAskHandler = (text: string) => void
const askHandlers = new Map<string, Set<OpenAskHandler>>()

/**
 * 注册指定会话的旁问弹窗打开回调。
 */
export function registerAskHandler(sessionId: string, handler: OpenAskHandler): () => void {
  let set = askHandlers.get(sessionId)
  if (!set) {
    set = new Set()
    askHandlers.set(sessionId, set)
  }
  set.add(handler)
  return () => {
    const s = askHandlers.get(sessionId)
    s?.delete(handler)
    if (s?.size === 0) askHandlers.delete(sessionId)
  }
}

/**
 * 触发指定会话打开旁问弹窗。
 */
export function triggerAskModal(sessionId: string, text: string): boolean {
  const set = askHandlers.get(sessionId)
  if (!set || set.size === 0) return false
  set.forEach(h => {
    try {
      h(text)
    } catch {}
  })
  return true
}

export interface NativeBtwAskActionProps {
  sessionId?: string
  dismiss: () => void
  readText: () => string | null
  clearSelection: () => void
  useSession?: (selector: (session: any) => any) => any
  t: BtwTranslate
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.chat.text-interaction': {
      kind: 'keyed'
      scope: 'session'
    }
  }
}

/**
 * 接入官方 conversation.chat.text-interaction 插槽的原生「旁问」按钮。
 * 当用户在正文划选文本时，随官方选区工具栏原生渲染。
 */
export function NativeBtwAskAction({
  sessionId,
  dismiss,
  readText,
  clearSelection,
  useSession,
  t,
}: NativeBtwAskActionProps): React.JSX.Element | null {
  const resolvedSessionId = sessionId ?? useSession?.((s: any) => s?.sessionId ?? s?.id)
  const enabled = useSession ? useSession((s: any) => !s?.removed && !s?.subagent) : true

  useEffect(() => {
    if (!enabled) dismiss()
  }, [enabled, dismiss])

  if (!enabled) return null

  const onClick = () => {
    const text = readText()
    if (text === null || !text.trim()) {
      dismiss()
      return
    }

    if (resolvedSessionId) {
      triggerAskModal(resolvedSessionId, text.trim())
    }
    clearSelection()
    dismiss()
  }

  return (
    <button
      type="button"
      className="btw-native-ask-action"
      aria-label={t('selection.btw')}
      onPointerDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {t('selection.btw')}
    </button>
  )
}
