import React, { useEffect, useRef, useState } from 'react'
import type { BtwTranslate } from '../locales'
import { formatQuotesWithDraft, jumpToQuote, type QuotedReference, type QuoteStore } from './quotes'
import { insertQuoteReference, QUOTE_TRIGGER_SOURCE } from './trigger-source'

interface DraftInput {
  state: { getSnapshot(): { draft: string; draftRev?: number; phase: string; occurrences?: readonly { source: string; ref: string }[] } }
  setDraft(text: string): void
  focus?(): void
  notify?(level: 'info' | 'error', text: string): void
  insertReference?(ref: unknown, span: unknown): boolean
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

    const consumeAndMerge = (source: 'enter' | 'click') => {
      const current = store.getQuotes(sessionId)
      if (current.length === 0) return
      const snapshot = input.state.getSnapshot()
      // 事务守卫：如果宿主处于提交事务中（submitting, adjudicating 等），严禁改写草稿，且绝不能清空引用
      if (snapshot.phase && snapshot.phase !== 'plain') return

      // 结构化引用守卫：若草稿中已挂载结构化引用，提交时由宿主按 source 自动序列化，不强行拍平！
      const hasStructuredRef = snapshot.occurrences?.some(o => o.source === QUOTE_TRIGGER_SOURCE)
      if (hasStructuredRef) {
        store.clearQuotes(sessionId)
        return
      }

      const merged = formatQuotesWithDraft(snapshot.draft, current, t)
      input.setDraft(merged)
      store.clearQuotes(sessionId)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
      const active = document.activeElement
      if (!active || !(active instanceof HTMLElement)) return

      // 严格排除：任何位于旁问弹窗、各种 Modal/Dialog 内部的输入框，防止污染主会话
      if (active.closest('.btw-selection-dialog, .btw-selection-modal, [role="dialog"], [data-btw-modal]')) return

      const isInput = active.matches('[data-dsh-composer-input]') ||
        active instanceof HTMLTextAreaElement ||
        (active.isContentEditable || active.matches('textarea, [contenteditable="true"]'))
      if (!isInput) return
      consumeAndMerge('enter')
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return
      // 严格排除：弹窗、模态对话框内部的任何按钮
      if (target.closest('.btw-selection-dialog, .btw-selection-modal, [role="dialog"], [data-btw-modal]')) return

      // 明确排除停止生成按钮（宿主停止按钮同样位于 composerCard 内部且为 primary，但不是提交操作）
      if (target.closest('button[aria-label*="停止"], button[aria-label*="Stop"]')) return

      // 宿主输入框发送语义按钮匹配：涵盖发送/Send、排队/Queue、插话/Steer
      const isSubmit = Boolean(
        target.closest(
          'button[aria-label*="发送"], ' +
          'button[aria-label*="Send"], ' +
          'button[aria-label*="排队"], ' +
          'button[aria-label*="Queue"], ' +
          'button[aria-label*="插话"], ' +
          'button[aria-label*="Steer"]'
        )
      )
      if (!isSubmit) return
      consumeAndMerge('click')
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
    if (snapshot.phase && snapshot.phase !== 'plain') return

    // 优先尝试作为结构化 Mention 胶囊插入输入框
    let allInserted = quotes.length > 0
    for (const q of quotes) {
      if (!insertQuoteReference(input as any, q, t)) {
        allInserted = false
        break
      }
    }

    if (allInserted) {
      store.clearQuotes(sessionId)
      setPopoverOpen(false)
      input.focus?.()
      return
    }

    // 降级回退到明文格式化草稿
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
                    onClick={() => {
                      const ok = jumpToQuote(quote)
                      if (!ok) input.notify?.('info', t('quote.jumpFailed'))
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        const ok = jumpToQuote(quote)
                        if (!ok) input.notify?.('info', t('quote.jumpFailed'))
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
