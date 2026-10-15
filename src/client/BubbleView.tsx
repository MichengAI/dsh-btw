import React, { useMemo, useState, useSyncExternalStore } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, LoaderCircle, MessageCircle, Square, X } from 'lucide-react'
import { AnswerMarkdown } from './answer-markdown'
import type { Bubble, BubbleStore } from './bubbles'
import type { BtwTranslate } from '../locales'

export function BubbleView({ item, close, t, collapsed, onToggleCollapse }: {
  item: Bubble
  close: () => void
  t: BtwTranslate
  collapsed: boolean
  onToggleCollapse: () => void
}): React.JSX.Element {
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
  const stopOrCloseTitle = item.closeFailed
    ? t('action.retryClose')
    : t(item.phase === 'answering' ? 'action.stop' : 'action.close')
  return <article className="btw-bubble" data-phase={item.phase} aria-label={t('bubble.label')}>
    <header className="btw-header">
      <span className="btw-symbol"><MessageCircle size={16} /></span>
      <span className="btw-question">{item.question}</span>
      <div className="btw-actions">
        {item.answer && <button type="button" title={t(copied ? 'action.copied' : 'action.copy')} aria-label={t('action.copy')} onClick={() => { void copy() }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>}
        <button type="button" title={t(collapsed ? 'action.expand' : 'action.collapse')} aria-label={t(collapsed ? 'action.expand' : 'action.collapse')} aria-expanded={!collapsed} onClick={onToggleCollapse}>{collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        <button
          type="button"
          className={item.phase === 'answering' ? 'btw-action-stop' : undefined}
          title={stopOrCloseTitle}
          aria-label={stopOrCloseTitle}
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

  // 手动覆盖状态：记录用户手动指定的展开 id（或 null 全部收起），同时记录设置该偏好时见到的气泡集合
  const [manual, setManual] = useState<{ id: string | null; knownIds: readonly string[] } | undefined>()

  // 仅当新气泡产生时（当前列表出现以往未见的新 id），才抢走展开焦点；单纯删除气泡不重置用户的手动偏好
  const hasNewlyAddedBubble = manual !== undefined && items.some(item => !manual.knownIds.includes(item.id))
  const currentIds = items.map(item => item.id)

  const isPinnedValid = manual !== undefined && !hasNewlyAddedBubble && manual.id !== null
    ? items.some(item => item.id === manual.id)
    : false

  const effectiveExpandedId = manual === undefined || hasNewlyAddedBubble
    ? latestId
    : (manual.id === null ? null : (isPinnedValid ? manual.id : latestId))

  if (!items.length) return null
  return <div className="btw-dock">
    {items.map(item => (
      <BubbleView
        key={item.id}
        item={item}
        t={t}
        collapsed={item.id !== effectiveExpandedId}
        onToggleCollapse={() => {
          if (item.id === effectiveExpandedId) setManual({ id: null, knownIds: currentIds })
          else setManual({ id: item.id, knownIds: currentIds })
        }}
        close={() => { void store.close(item.id) }}
      />
    ))}
  </div>
}
