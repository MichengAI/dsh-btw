import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReferenceChip } from '@deepseek-ai/dsh-client-ui-primitives'
import { jumpToQuote } from './quotes'
import { translate, type BtwTranslate } from '../locales'

export interface ParsedQuoteItem {
  readonly label: string
  readonly text: string
  readonly role?: 'assistant' | 'user'
  readonly turnIndex?: number
}

export interface QuoteNodeData {
  readonly label: string
  readonly count: number
  readonly raw: string
  readonly items: readonly ParsedQuoteItem[]
  readonly isEn: boolean
  readonly role?: 'assistant' | 'user'
  readonly turnIndex?: number
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface UserTextDataMap {
    'dsh-btw-quote': QuoteNodeData
    'quote': { text: string }
  }
}

export function parseQuotePromptBlock(text: string, from = 0): {
  start: number
  end: number
  data: QuoteNodeData
} | undefined {
  const zhHeading = '# 划选引用与上下文 (Selected Context)'
  const enHeading = '# Selected text & context:'

  let start = text.indexOf(zhHeading, from)
  let isEn = false
  if (start < 0) {
    start = text.indexOf(enHeading, from)
    isEn = true
  }

  if (start < 0) return undefined

  // 约束：heading 之前只允许空白字符，防止匹配正文中偶尔贴入的字样
  const prefix = text.slice(from, start)
  if (prefix.trim().length > 0) return undefined

  const sep = isEn ? '--- \n## User Request:\n\n' : '--- \n## 用户需求与指示：\n\n'
  const altSep = isEn ? '## User Request:\n\n' : '## 用户需求与指示：\n\n'
  let sepIdx = text.indexOf(sep, start)
  let end = sepIdx >= 0 ? sepIdx + sep.length : -1
  if (end < 0) {
    sepIdx = text.indexOf(altSep, start)
    end = sepIdx >= 0 ? sepIdx + altSep.length : -1
  }
  if (end < 0) {
    end = text.length
  }

  const block = text.slice(start, end)
  const regex = /> \[(?:来自|From )([^\]]+)\]:([^\n]*(?:\n(?!> \[(?:来自|From )).*)*)/g
  const items: ParsedQuoteItem[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(block)) !== null) {
    const fromStr = (match[1] ?? '').trim()
    const rawContent = match[2] ?? ''
    const textLines = rawContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('> '))
      .map(line => line.slice(2).trim())
      .filter(Boolean)
    const quoteText = textLines.join('\n')

    let role: 'assistant' | 'user' | undefined
    if (fromStr.includes('助手') || fromStr.toLowerCase().includes('assistant')) {
      role = 'assistant'
    } else if (fromStr.includes('用户') || fromStr.toLowerCase().includes('user')) {
      role = 'user'
    }
    const numMatch = fromStr.match(/\d+/)
    const turnIndex = numMatch ? Number(numMatch[0]) : undefined

    items.push({
      label: isEn ? `Source · ${fromStr}` : `出处 · ${fromStr}`,
      text: quoteText,
      role,
      turnIndex,
    })
  }

  // 约束：必须真正包含至少一条解析成功的引文条目，否则不视为合法引用块
  if (items.length === 0) return undefined

  const count = items.length
  let label: string
  let role: 'assistant' | 'user' | undefined
  let turnIndex: number | undefined

  if (count === 1 && items[0]) {
    role = items[0].role
    turnIndex = items[0].turnIndex
    if (isEn) {
      label = turnIndex ? `Quote · Turn ${turnIndex}` : `Quote · ${items[0].label}`
    } else {
      label = turnIndex ? `引用 · 第 ${turnIndex} 轮` : `引用 · ${items[0].label}`
    }
  } else {
    label = isEn ? `${count} quotes` : `${count} 条引用`
  }

  return {
    start,
    end,
    data: {
      label,
      count,
      raw: block,
      items,
      isEn,
      role,
      turnIndex,
    },
  }
}

export const quoteUserTextRule = {
  id: 'dsh-btw-quote' as const,
  order: 5,
  match(text: string, from: number): {
    id: 'dsh-btw-quote'
    start: number
    end: number
    data: QuoteNodeData
  } | undefined {
    const res = parseQuotePromptBlock(text, from)
    if (!res) return undefined
    return {
      id: 'dsh-btw-quote',
      start: res.start,
      end: res.end,
      data: res.data,
    }
  },
}

export function QuoteUserTextNode(props: {
  readonly node: {
    readonly id: 'dsh-btw-quote'
    readonly data: QuoteNodeData
  }
  readonly t?: BtwTranslate
}): React.JSX.Element {
  const { node } = props
  const [open, setOpen] = useState(false)
  const chipWrapperRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const t = props.t ?? translate(node.data.isEn ? 'en' : 'zh')

  const updatePosition = () => {
    if (!chipWrapperRef.current) return
    const rect = chipWrapperRef.current.getBoundingClientRect()
    const cardWidth = Math.min(420, window.innerWidth - 24)
    // 优先在下方展示；若下方空间不足（少于 220px）且上方空间充裕，则在上方展示
    let top = rect.bottom + 6 + window.scrollY
    if (rect.bottom + 260 > window.innerHeight && rect.top > 260) {
      top = rect.top - 6 - 240 + window.scrollY
    }
    let left = rect.left + window.scrollX
    if (left + cardWidth > window.innerWidth - 12) {
      left = window.innerWidth - cardWidth - 12 + window.scrollX
    }
    if (left < 12) left = 12
    setPos({ top, left })
  }

  const handleActivate = () => {
    if (!open) {
      updatePosition()
    }
    setOpen(prev => !prev)
  }

  const handleJump = (item: ParsedQuoteItem) => {
    if (item.role && item.turnIndex !== undefined) {
      jumpToQuote({
        id: '',
        sessionId: '',
        createdAt: 0,
        text: item.text,
        role: item.role,
        turnIndex: item.turnIndex,
      })
    }
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (
        chipWrapperRef.current &&
        !chipWrapperRef.current.contains(target) &&
        !document.querySelector('.btw-user-bubble-popover')?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScrollOrResize = () => {
      updatePosition()
    }

    document.addEventListener('mousedown', onClickOutside, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', onClickOutside, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open])

  const popover = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="btw-codex-popover btw-user-bubble-popover"
          style={{
            position: 'absolute',
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            bottom: 'auto',
            zIndex: 10000,
            width: 'min(420px, calc(100vw - 24px))',
            boxSizing: 'border-box',
          }}
          role="dialog"
          aria-label={t('quote.panelTitle')}
        >
          <div className="btw-codex-popover-header">
            <div className="btw-codex-popover-title-group">
              <span className="btw-codex-popover-icon" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 4.75a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75z" />
                </svg>
              </span>
              <span className="btw-codex-popover-title-text">{t('quote.detailTitle')}</span>
              <span className="btw-codex-count-badge">{node.data.items.length}</span>
            </div>
            <div className="btw-codex-popover-actions">
              <button
                type="button"
                className="btw-codex-pill-remove"
                onClick={() => setOpen(false)}
                aria-label={t('quote.close')}
                title={t('quote.close')}
              >
                ×
              </button>
            </div>
          </div>
          <div className="btw-codex-popover-list">
            {node.data.items.map((item, idx) => (
              <div key={idx} className="btw-codex-comment-card">
                <div className="btw-codex-card-header">
                  <span className="btw-codex-tag-badge">{item.label}</span>
                  {item.turnIndex !== undefined && (
                    <button
                      type="button"
                      className="btw-codex-action-btn"
                      onClick={() => handleJump(item)}
                      title={t('quote.jump')}
                    >
                      {t('quote.jump')}
                    </button>
                  )}
                </div>
                <div className="btw-codex-card-body">
                  <blockquote>{item.text}</blockquote>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null

  const titlePreview = node.data.items.map(it => `${it.label}: ${it.text}`).join('\n') || node.data.label

  return (
    <span
      ref={chipWrapperRef}
      className="btw-user-quote-chip-wrapper"
      style={{ display: 'inline-flex', alignItems: 'center', margin: '2px 4px 2px 0' }}
    >
      <ReferenceChip
        appearance="file"
        label={node.data.label}
        title={titlePreview}
        onActivate={handleActivate}
      />
      {popover}
    </span>
  )
}
