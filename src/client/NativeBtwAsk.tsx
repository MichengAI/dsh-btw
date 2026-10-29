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

/**
 * 安全向 uiConversation.interactions 注册交互项（避免重复注册已存在的 ID 抛错）。
 */
export function safeRegisterInteraction(
  interactions: { definitions?: Map<string, unknown>; has?: (id: string) => boolean; register?: (item: unknown) => () => void } | undefined,
  item: { id: string; onInteraction: (request: any) => void }
): (() => void) | undefined {
  if (!interactions || typeof interactions.register !== 'function') return undefined
  if (interactions.definitions?.has(item.id) || interactions.has?.(item.id)) return undefined
  try {
    return interactions.register(item)
  } catch {
    return undefined
  }
}

/**
 * 监听并向宿主官方选区浮层（[data-text-interaction-surface]）动态融入「旁问」按钮。
 * 当宿主启用了官方 text-interaction 浮层时，并排呈现 [引用文本] [旁问]，绝不丢失旁问入口。
 */
export function attachNativeAskButton(
  scope: HTMLElement,
  sessionId: string,
  t: BtwTranslate
): () => void {
  const doc = scope.ownerDocument
  const sync = () => {
    const surface = doc.querySelector<HTMLElement>('[data-text-interaction-surface]:not([aria-hidden="true"])')
    if (!surface) return
    const quoteBtn = surface.querySelector<HTMLButtonElement>('button:not(.btw-native-ask-button)')
    if (!quoteBtn) return

    let btwBtn = surface.querySelector<HTMLButtonElement>('.btw-native-ask-button')
    if (!btwBtn) {
      btwBtn = doc.createElement('button')
      btwBtn.type = 'button'
      btwBtn.className = `${quoteBtn.className} btw-native-ask-button`
      btwBtn.textContent = t('selection.btw')
      btwBtn.setAttribute('aria-label', t('selection.btw'))
      btwBtn.onpointerdown = (e) => e.preventDefault()
      btwBtn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        const text = doc.getSelection()?.toString().trim()
        if (text) {
          triggerAskModal(sessionId, text)
        }
        doc.getSelection()?.removeAllRanges()
        surface.setAttribute('aria-hidden', 'true')
      }
    }

    // 核心保证：
    // 1. 物理位置：确保 btwBtn 始终插入在 quoteBtn 后面
    if (quoteBtn.nextSibling !== btwBtn) {
      quoteBtn.after(btwBtn)
    }

    // 2. 视觉层级与外边距清空：由 flex gap 统一控制等距间距
    quoteBtn.style.order = '1'
    quoteBtn.style.margin = '0'
    btwBtn.style.order = '2'
    btwBtn.style.margin = '0'
  }

  const observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(sync)
    : undefined
  observer?.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden'],
  })
  doc.addEventListener('selectionchange', sync)
  doc.addEventListener('mouseup', sync)
  sync()

  return () => {
    observer?.disconnect()
    doc.removeEventListener('selectionchange', sync)
    doc.removeEventListener('mouseup', sync)
  }
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
