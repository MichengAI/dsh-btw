import React, { useMemo, useState, useSyncExternalStore } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, LoaderCircle, MessageCircle, Square, X } from 'lucide-react'
import { AnswerMarkdown } from './answer-markdown'
import type { Bubble, BubbleStore } from './bubbles'
import type { BtwTranslate } from '../locales'

export function BubbleView({ item, close, t, collapsed: externalCollapsed, onToggleCollapse }: {
  item: Bubble
  close: () => void
  t: BtwTranslate
  collapsed?: boolean
  onToggleCollapse?: () => void
}): React.JSX.Element {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isControlled = externalCollapsed !== undefined
  const collapsed = isControlled ? externalCollapsed : internalCollapsed
  const toggleCollapse = () => {
    if (onToggleCollapse) onToggleCollapse()
    else setInternalCollapsed(!internalCollapsed)
  }
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const busy = item.phase === 'answering' || item.phase === 'closing'
  const labels = useMemo(() => ({
    code: { copyLabel: t('action.copyCode'), copiedLabel: t('action.copiedCode') },
    footnotes: t('bubble.footnotes'),
  }), [t])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.answer)
      setCopied(true)
      setCopyError(false)
    } catch { setCopyError(true) }
  }
  return <article className="btw-bubble" data-phase={item.phase} aria-label={t('bubble.label')}>
    <header className="btw-header">
      <span className="btw-symbol"><MessageCircle size={16} /></span>
      <span className="btw-question">{item.question}</span>
      <div className="btw-actions">
        {item.answer && <button type="button" title={t(copied ? 'action.copied' : 'action.copy')} aria-label={t('action.copy')} onClick={() => { void copy() }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>}
        <button type="button" title={t(collapsed ? 'action.expand' : 'action.collapse')} aria-label={t(collapsed ? 'action.expand' : 'action.collapse')} aria-expanded={!collapsed} onClick={toggleCollapse}>{collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        <button
          type="button"
          className={item.phase === 'answering' ? 'btw-action-stop' : undefined}
          title={t(item.phase === 'answering' ? 'action.stop' : item.closeFailed ? 'action.retryClose' : 'action.close')}
          aria-label={t(item.phase === 'answering' ? 'action.stop' : 'action.close')}
          disabled={item.phase === 'closing'}
          onClick={close}
        >
          {item.phase === 'answering' ? <Square size={14} /> : <X size={16} />}
        </button>
      </div>
    </header>
    {!collapsed && item.reference && <details className="btw-reference"><summary>{t('selection.reference')}</summary><blockquote>{item.reference}</blockquote></details>}
    {busy && <div className="btw-status" role="status"><LoaderCircle size={14} className="btw-spinner" />{t(item.phase === 'closing' ? 'status.closing' : 'status.answering')}</div>}
    {!collapsed && item.answer && <div className="btw-answer"><AnswerMarkdown text={item.answer} labels={labels} imageLabel={t('bubble.image')} /></div>}
    {item.error && <p className="btw-error" role="alert">{item.closeFailed ? t('error.close', { detail: item.error }) : item.error}</p>}
    {copyError && <p className="btw-error" role="alert">{t('error.copy')}</p>}
  </article>
}

export function BubbleDock({ store, sessionId, t }: { store: BubbleStore; sessionId: string; t: BtwTranslate }): React.JSX.Element | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const items = snapshot.filter(item => item.sessionId === sessionId)
  const latestId = items.at(-1)?.id
  const [activeExpandedId, setActiveExpandedId] = useState<string | null>(null)

  // 当有新气泡生成时，默认焦点落在最新气泡上，老气泡自动收起；
  // 用户也可以随时手动展开/收起任何一个气泡
  const effectiveExpandedId = activeExpandedId ?? latestId

  if (!items.length) return null
  return <div className="btw-dock">
    {items.map(item => (
      <BubbleView
        key={item.id}
        item={item}
        t={t}
        collapsed={item.id !== effectiveExpandedId}
        onToggleCollapse={() => {
          if (item.id === effectiveExpandedId) setActiveExpandedId('')
          else setActiveExpandedId(item.id)
        }}
        close={() => { void store.close(item.id) }}
      />
    ))}
  </div>
}
