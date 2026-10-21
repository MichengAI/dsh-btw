import React, { useEffect, useRef, useState } from 'react'
import type { BtwTranslate } from '../locales'
import { formatQuotesWithDraft, jumpToQuote, type QuotedReference, type QuoteStore } from './quotes'

interface DraftInput {
  state: { getSnapshot(): { draft: string; phase: string } }
  setDraft(text: string): void
  focus?(): void
}

export function QuoteDock({
  store,
  sessionId,
  t,
  input,
}: {
  store: QuoteStore
  sessionId: string
  t: BtwTranslate
  input: DraftInput
}): React.JSX.Element | null {
  const [quotes, setQuotes] = useState<readonly QuotedReference[]>(() => store.getQuotes(sessionId))
  const [popoverOpen, setPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuotes(store.getQuotes(sessionId))
    return store.subscribe(() => {
      setQuotes(store.getQuotes(sessionId))
    })
  }, [store, sessionId])

  // 点击外部关闭 Popover
  useEffect(() => {
    if (!popoverOpen) return
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPopoverOpen(false)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside, true)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside, true)
      document.removeEventListener('keydown', onEscape)
    }
  }, [popoverOpen])

  useEffect(() => {
    if (quotes.length === 0) {
      setPopoverOpen(false)
      return
    }

    const consumeAndMerge = () => {
      const current = store.getQuotes(sessionId)
      if (current.length === 0) return
      const snapshot = input.state.getSnapshot()
      const merged = formatQuotesWithDraft(snapshot.draft, current, t)
      input.setDraft(merged)
      store.clearQuotes(sessionId)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
      const active = document.activeElement
      const isInput = active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && (active.isContentEditable || active.matches('[data-dsh-composer-input], textarea, [contenteditable="true"]')))
      if (!isInput) return
      consumeAndMerge()
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const isSubmit = target?.closest('button[type="submit"], [data-composer-submit], [aria-label*="发送"], [aria-label*="Send"]')
      if (!isSubmit) return
      consumeAndMerge()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [store, sessionId, input, quotes.length, t])

  if (quotes.length === 0) return null

  const expandToDraft = () => {
    const snapshot = input.state.getSnapshot()
    const merged = formatQuotesWithDraft(snapshot.draft, quotes, t)
    input.setDraft(merged)
    store.clearQuotes(sessionId)
    setPopoverOpen(false)
    input.focus?.()
  }

  const clearAll = () => {
    store.clearQuotes(sessionId)
    setPopoverOpen(false)
  }

  return (
    <div className="btw-quote-dock" ref={containerRef} role="region" aria-label={t('quote.count', { count: quotes.length })}>
      {/* 完全对齐 Codex 的全圆角胶囊药丸 (Pill) */}
      <div
        className={`btw-codex-pill ${popoverOpen ? 'btw-codex-pill-active' : ''}`}
        onClick={() => setPopoverOpen(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setPopoverOpen(prev => !prev)
          }
        }}
      >
        <span className="btw-codex-pill-icon" aria-hidden="true">
          {/* Codex 风格的两横线批注图标 */}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 4.75a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75z" />
          </svg>
        </span>
        <span className="btw-codex-pill-label">{t('quote.count', { count: quotes.length })}</span>
        <button
          type="button"
          className="btw-codex-pill-remove"
          aria-label={t('quote.clear')}
          title={t('quote.clear')}
          onClick={e => {
            e.stopPropagation()
            clearAll()
          }}
        >
          ×
        </button>
      </div>

      {/* 点击药丸弹出的 Codex 风格批注抽屉卡片列表 */}
      {popoverOpen && (
        <div className="btw-codex-popover" role="dialog" aria-modal="false" aria-label={t('quote.panelTitle')}>
          <div className="btw-codex-popover-header">
            <div className="btw-codex-popover-title-group">
              <span className="btw-codex-popover-icon" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 4.75a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75z" />
                </svg>
              </span>
              <span className="btw-codex-popover-title-text">{t('quote.panelTitle')}</span>
              <span className="btw-codex-count-badge">{quotes.length}</span>
            </div>
            <div className="btw-codex-popover-actions">
              <button type="button" className="btw-codex-action-btn" onClick={expandToDraft} title={t('quote.toDraft')}>
                {t('quote.toDraft')}
              </button>
              <button type="button" className="btw-codex-action-btn" onClick={clearAll} title={t('quote.clear')}>
                {t('quote.clear')}
              </button>
            </div>
          </div>
          <div className="btw-codex-popover-list">
            {quotes.map(quote => {
              const roleName = quote.role === 'user' ? t('quote.role.user') : t('quote.role.assistant')
              const turnStr = quote.turnIndex ? t('quote.turn', { turn: quote.turnIndex }) : ''
              const label = `${t('quote.source')} · ${roleName}${turnStr}`
              const preview = quote.text.length > 120 ? `${quote.text.slice(0, 120)}…` : quote.text

              return (
                <div key={quote.id} className="btw-codex-comment-card">
                  <div className="btw-codex-card-header">
                    <span className="btw-codex-tag-badge">{label}</span>
                    <button
                      type="button"
                      className="btw-codex-card-remove"
                      aria-label={t('quote.remove')}
                      title={t('quote.remove')}
                      onClick={() => store.removeQuote(sessionId, quote.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    className="btw-codex-card-body"
                    role="button"
                    tabIndex={0}
                    onClick={() => jumpToQuote(quote)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        jumpToQuote(quote)
                      }
                    }}
                    title={t('quote.jump')}
                  >
                    <blockquote>{preview}</blockquote>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
