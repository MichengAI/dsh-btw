import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BubbleStore } from './bubbles'
import type { BtwTranslate } from '../locales'
import { MAX_QUESTION_LENGTH, MAX_REFERENCE_LENGTH } from '../shared'
import { captureSelection } from './selection'

interface SelectionDraft { reference: string; x: number; y: number; bottom: number; form: boolean }

/** 只接管会话正文选区；非模态 popover 不抢选区，顶层避免滚动裁切。 */
export function SelectionAsk({ store, sessionId, t, addToConversation }: { store: BubbleStore; sessionId: string; t: BtwTranslate; addToConversation: (reference: string) => void }): React.JSX.Element {
  const anchor = useRef<HTMLSpanElement>(null)
  const dialog = useRef<HTMLDialogElement | HTMLDivElement | null>(null)
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
      if ((dialog.current instanceof HTMLDialogElement && dialog.current.open) || (event instanceof MouseEvent && event.button !== 0)) return
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      const reference = captureSelection(scope, event.target)
      if (!reference) return
      const rect = document.getSelection()!.getRangeAt(0).getBoundingClientRect()
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setQuestion('')
      setError('')
      setDraft({ reference, x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom, form: false })
    }
    scope.addEventListener('mouseup', open)
    scope.addEventListener('keyup', open)
    return () => { mounted.current = false; scope.removeEventListener('mouseup', open); scope.removeEventListener('keyup', open) }
  }, [sessionId])

  useLayoutEffect(() => {
    const element = dialog.current
    if (!draft || !element) return
    if (!draft.form) {
      element.setAttribute('popover', 'manual')
      element.showPopover()
      const rect = element.getBoundingClientRect()
      element.style.left = `${Math.max(8, Math.min(draft.x - rect.width / 2, window.innerWidth - rect.width - 8))}px`
      element.style.top = `${Math.max(8, Math.min(draft.y >= rect.height + 16 ? draft.y - rect.height - 8 : draft.bottom + 8, window.innerHeight - rect.height - 8))}px`
    } else {
      if (element.hasAttribute('popover')) { element.hidePopover(); element.removeAttribute('popover') }
      if (element instanceof HTMLDialogElement && !element.open) element.showModal()
      element.style.removeProperty('left')
      element.style.removeProperty('top')
    }
    if (draft.form) element.querySelector<HTMLElement>('textarea')?.focus()
  }, [draft])

  useEffect(() => {
    if (!draft) return
    const scope = anchor.current?.closest<HTMLElement>('[data-conversation-scroll]')
    // 会话可能只隐藏而不卸载；顶层菜单不能脱离原会话继续显示。
    const hide = () => setDraft(undefined)
    const hideMenu = () => { if (!draft.form) hide() }
    const visibility = () => { if (document.hidden) hideMenu() }
    const scroll = (event: Event) => {
      if (event.target instanceof Node && dialog.current?.contains(event.target)) return
      hideMenu()
    }
    const outside = (event: MouseEvent) => { if (!dialog.current?.contains(event.target as Node)) hideMenu() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hideMenu() }
    const selection = () => { if (document.getSelection()?.isCollapsed) hideMenu() }
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
    if (!draft || submitting.current) return
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
    try { addToConversation(draft.reference); setDraft(undefined) }
    catch (issue) { setError(issue instanceof Error ? issue.message : String(issue)) }
  }

  const Surface = draft?.form ? 'dialog' : 'div'
  return <><span ref={anchor} hidden />{draft && <Surface ref={(element: HTMLDialogElement | HTMLDivElement | null) => { dialog.current = element }}
    className={draft.form ? 'btw-selection-dialog' : 'btw-selection-menu'}
    aria-label={t('selection.ask')}
    onCancel={event => { event.preventDefault(); dismiss() }}
    onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dismiss()
    }}>
    {draft.form ? <form onSubmit={event => { event.preventDefault(); void send(question) }}>
      <h3>{t('selection.ask')}</h3>
      <details className="btw-reference"><summary>{t('selection.reference')} · {draft.reference.length}<span className="btw-reference-preview">{draft.reference.slice(0, 120)}{draft.reference.length > 120 ? '…' : ''}</span></summary><blockquote>{draft.reference}</blockquote></details>
      <label><span>{t('selection.question')}</span><textarea value={question} disabled={busy} maxLength={MAX_QUESTION_LENGTH}
        onChange={event => setQuestion(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send(question) }
        }} /></label>
      <p className="btw-selection-hint">{t('selection.context')}</p>
      <div className="btw-selection-actions">
        <button type="button" disabled={busy} onClick={dismiss}>{t('selection.cancel')}</button>
        <button type="button" disabled={busy || draft.reference.length > MAX_REFERENCE_LENGTH} onClick={() => { void send(t('selection.explain')) }}>{t('selection.explain')}</button>
        <button type="submit" disabled={busy || !question.trim() || draft.reference.length > MAX_REFERENCE_LENGTH}>{t('selection.send')}</button>
      </div>
    </form> : <div role="toolbar" aria-label={t('selection.ask')} onMouseDown={event => event.preventDefault()}>
      <button type="button" onClick={add}>{t('selection.add')}</button>
      <button type="button" onClick={() => setDraft({ ...draft, form: true })}>{t('selection.btw')}</button>
    </div>}
    {draft.form && draft.reference.length > MAX_REFERENCE_LENGTH && <p className="btw-error" role="alert">{t('error.reference')}</p>}
    {error && <p className="btw-error" role="alert">{error}</p>}
  </Surface>}</>
}
