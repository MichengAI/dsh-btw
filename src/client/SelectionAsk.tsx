import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BubbleStore } from './bubbles'
import type { BtwTranslate } from '../locales'
import { MAX_QUESTION_LENGTH, MAX_REFERENCE_LENGTH } from '../shared'
import { QuoteDock } from './QuoteDock'
import type { QuoteStore } from './quotes'
import { captureSelection, captureSelectionDetails, type CapturedSelectionDetails } from './selection'

interface DraftInput {
  state: { getSnapshot(): { draft: string; phase: string } }
  setDraft(text: string): void
  focus?(): void
  notify?(level: 'info' | 'error', text: string): void
}

interface SelectionDraft {
  reference: string
  details?: CapturedSelectionDetails
  x: number
  y: number
  bottom: number
  keyboard: boolean
  form: boolean
}

/** 只接管会话正文选区；非模态 popover 不抢选区，顶层避免滚动裁切。 */
export function SelectionAsk({
  store,
  quoteStore,
  sessionId,
  t,
  input,
  addToConversation,
}: {
  store: BubbleStore
  quoteStore?: QuoteStore
  sessionId: string
  t: BtwTranslate
  input?: DraftInput
  addToConversation?: (reference: string) => void
}): React.JSX.Element {
  const anchor = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const mounted = useRef(false)
  const submitting = useRef(false)
  const [draft, setDraft] = useState<SelectionDraft>()
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dismiss = () => {
    if (submitting.current) return
    setDraft(undefined)
    previousFocus.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    mounted.current = true
    const scope = anchor.current?.closest<HTMLElement>('[data-conversation-scroll]')
    // 不猜测第三方布局；没有正文所属容器时仅保留 /btw 入口。
    if (!scope) return () => { mounted.current = false }
    const open = (event: MouseEvent | KeyboardEvent) => {
      // 只响应选区按键，避免 Escape 的 keyup 撤销刚发生的关闭。
      if (event instanceof KeyboardEvent && (event.isComposing || !(event.key === 'Shift' || (event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))))) return
      if (draft?.form || (event instanceof MouseEvent && event.button !== 0)) return
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      const details = captureSelectionDetails(scope, event.target)
      if (!details) return
      const rect = document.getSelection()!.getRangeAt(0).getBoundingClientRect()
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setQuestion('')
      setError('')
      setDraft({
        reference: details.text,
        details,
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
        keyboard: event instanceof KeyboardEvent && event.key === 'Shift',
        form: false,
      })
    }
    scope.addEventListener('mouseup', open)
    scope.addEventListener('keyup', open)
    return () => { mounted.current = false; scope.removeEventListener('mouseup', open); scope.removeEventListener('keyup', open) }
  }, [sessionId, draft?.form])

  useLayoutEffect(() => {
    const element = menu.current
    if (!draft || draft.form || !element) return
    if (typeof element.showPopover === 'function' && typeof element.hidePopover === 'function') {
      element.setAttribute('popover', 'manual')
      if (!element.matches(':popover-open')) element.showPopover()
    }
    const rect = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(draft.x - rect.width / 2, window.innerWidth - rect.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(draft.y >= rect.height + 16 ? draft.y - rect.height - 8 : draft.bottom + 8, window.innerHeight - rect.height - 8))}px`
    if (draft.keyboard) element.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [draft])

  // 只在浮层类型切换或卸载时释放顶层
  useLayoutEffect(() => {
    const element = menu.current
    return () => {
      if (!element) return
      if (typeof element.hidePopover === 'function' && element.hasAttribute('popover') && element.matches(':popover-open')) element.hidePopover()
    }
  }, [draft?.form])

  useEffect(() => {
    if (!draft) return
    const scope = anchor.current?.closest<HTMLElement>('[data-conversation-scroll]')
    // 会话可能只隐藏而不卸载；顶层菜单不能脱离原会话继续显示。
    const hide = () => setDraft(undefined)
    const hideMenu = () => { if (!draft.form) hide() }
    const visibility = () => { if (document.hidden) hideMenu() }
    const scroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return
      hideMenu()
    }
    const outside = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) hideMenu() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hideMenu() }
    const selection = () => { if (document.getSelection()?.isCollapsed && !menu.current?.contains(document.activeElement)) hideMenu() }
    document.addEventListener('mousedown', outside, true)
    document.addEventListener('keydown', key)
    document.addEventListener('selectionchange', selection)
    window.addEventListener('blur', hideMenu)
    window.addEventListener('resize', hideMenu)
    document.addEventListener('visibilitychange', visibility)
    scope?.addEventListener('scroll', scroll, true)
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      if (entries.some(entry => !entry.isIntersecting)) hide()
    })
    if (scope) observer?.observe(scope)
    return () => {
      document.removeEventListener('mousedown', outside, true)
      document.removeEventListener('keydown', key)
      document.removeEventListener('selectionchange', selection)
      window.removeEventListener('blur', hideMenu)
      window.removeEventListener('resize', hideMenu)
      document.removeEventListener('visibilitychange', visibility)
      scope?.removeEventListener('scroll', scroll, true)
      observer?.disconnect()
    }
  }, [draft])

  const send = async (value: string) => {
    if (!draft || submitting.current || !value.trim() || draft.reference.length > MAX_REFERENCE_LENGTH) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await store.ask(sessionId, value.trim(), draft.reference)
      if (mounted.current) { setDraft(undefined); previousFocus.current?.focus({ preventScroll: true }) }
    } catch (issue) {
      if (mounted.current) setError(issue instanceof Error ? issue.message : String(issue))
    } finally {
      submitting.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const add = () => {
    if (!draft) return
    try {
      if (quoteStore && draft.details) {
        quoteStore.addQuote(sessionId, {
          text: draft.details.text,
          role: draft.details.role,
          turnIndex: draft.details.turnIndex,
          anchorElement: draft.details.element,
          t,
        })
      } else if (quoteStore) {
        quoteStore.addQuote(sessionId, {
          text: draft.reference,
          t,
        })
      }
      addToConversation?.(draft.reference)
      setDraft(undefined)
    } catch (issue) {
      const msg = issue instanceof Error ? issue.message : String(issue)
      setError(msg)
      input?.notify?.('error', msg)
    }
  }

  return (
    <>
      <span ref={anchor} hidden />
      {quoteStore && input && <QuoteDock store={quoteStore} sessionId={sessionId} t={t} input={input} />}
      {draft && !draft.form && (
        <div
          ref={menu}
          className="btw-selection-menu"
          role="toolbar"
          aria-label={t('selection.ask')}
          onMouseDown={event => event.preventDefault()}
        >
          <button type="button" onClick={add}>{t('selection.add')}</button>
          <button type="button" onClick={() => setDraft({ ...draft, form: true })}>{t('selection.btw')}</button>
        </div>
      )}
      {draft?.form && (
        <Modal
          open={draft.form}
          onClose={dismiss}
          title={t('selection.ask')}
          closeLabel={t('selection.cancel')}
          className="btw-selection-dialog btw-selection-modal"
          footer={
            <div className="btw-selection-actions">
              <Button variant="outline" disabled={busy} onClick={dismiss}>
                {t('selection.cancel')}
              </Button>
              <Button
                variant="outline"
                disabled={busy || draft.reference.length > MAX_REFERENCE_LENGTH}
                onClick={() => { void send(t('selection.explain')) }}
              >
                {t('selection.explain')}
              </Button>
              <Button
                variant="primary"
                disabled={busy || !question.trim() || draft.reference.length > MAX_REFERENCE_LENGTH}
                onClick={() => { void send(question) }}
              >
                {t('selection.send')}
              </Button>
            </div>
          }
        >
          <form onSubmit={event => { event.preventDefault(); void send(question) }}>
            <details className="btw-reference">
              <summary>
                <span className="btw-codex-tag-badge">{t('quote.source')}</span> {t('selection.reference')} · {draft.reference.length}
                <span className="btw-reference-preview">{draft.reference.slice(0, 120)}{draft.reference.length > 120 ? '…' : ''}</span>
              </summary>
              <blockquote>{draft.reference}</blockquote>
            </details>
            <label className="btw-selection-label">
              <span>{t('selection.question')}</span>
              <textarea
                value={question}
                disabled={busy}
                maxLength={MAX_QUESTION_LENGTH}
                placeholder={t('selection.questionPlaceholder')}
                autoFocus
                onChange={event => setQuestion(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                    event.preventDefault()
                    void send(question)
                  }
                }}
              />
            </label>
            <p className="btw-selection-hint">{t('selection.context')}</p>
            {draft.reference.length > MAX_REFERENCE_LENGTH && <p className="btw-error" role="alert">{t('error.reference')}</p>}
            {error && <p className="btw-error" role="alert">{error}</p>}
          </form>
        </Modal>
      )}
    </>
  )
}
