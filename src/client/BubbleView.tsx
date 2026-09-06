import React, { useState, useSyncExternalStore } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, LoaderCircle, MessageCircle, X } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Bubble, BubbleStore } from './bubbles'
import type { BtwTranslate } from '../locales'

export function BubbleView({ item, close, t }: { item: Bubble; close: () => void; t: BtwTranslate }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const busy = item.phase === 'answering' || item.phase === 'closing'
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
        <button type="button" title={t(collapsed ? 'action.expand' : 'action.collapse')} aria-label={t(collapsed ? 'action.expand' : 'action.collapse')} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        <button type="button" title={t(item.closeFailed ? 'action.retryClose' : 'action.close')} aria-label={t('action.close')} disabled={item.phase === 'closing'} onClick={close}><X size={16} /></button>
      </div>
    </header>
    {busy && <div className="btw-status" role="status"><LoaderCircle size={14} className="btw-spinner" />{t(item.phase === 'closing' ? 'status.closing' : 'status.answering')}</div>}
    {!collapsed && item.answer && <div className="btw-answer"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
      a: props => <a href={props.href} target="_blank" rel="noreferrer noopener">{props.children}</a>,
      img: props => <span>{props.alt || t('bubble.image')}</span>,
    }}>{item.answer}</Markdown></div>}
    {item.error && <p className="btw-error" role="alert">{item.closeFailed ? t('error.close', { detail: item.error }) : item.error}</p>}
    {copyError && <p className="btw-error" role="alert">{t('error.copy')}</p>}
  </article>
}

export function BubbleDock({ store, sessionId, t }: { store: BubbleStore; sessionId: string; t: BtwTranslate }): React.JSX.Element | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const items = snapshot.filter(item => item.sessionId === sessionId)
  if (!items.length) return null
  return <div className="btw-dock">{items.map(item => <BubbleView key={item.id} item={item} t={t} close={() => { void store.close(item.id) }} />)}</div>
}
