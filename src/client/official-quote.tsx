import React from 'react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * 将文本格式化为对齐官方规范的 Markdown blockquote 格式。
 * 每一行均加上 `> ` 前缀。
 */
export function formatAsBlockquote(text: string): string {
  const normalized = text.replace(/\r\n?/gu, '\n').trim()
  if (!normalized) return ''
  return normalized
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
}

/**
 * 剥离 Markdown blockquote 前缀（最多 3 个前导空格 + > + 可选空格或制表符）。
 */
export function quoteTextOf(text: string): string {
  return text.replace(/\r\n?/gu, '\n').replace(/^ {0,3}>[ \t]?/gmu, '')
}

/**
 * 识别消息文本中显式带有 `> ` 标记的连续引用块。
 */
export function messageQuoteRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  for (const match of text.matchAll(/^ {0,3}>[^\r\n]*(?:\r?\n {0,3}>[^\r\n]*)*/gmu)) {
    if (quoteTextOf(match[0]).trim() !== '') {
      ranges.push({
        start: match.index!,
        end: match.index! + match[0].length,
      })
    }
  }
  return ranges
}

export interface QuoteNodeMatch {
  id: 'quote' | 'text'
  start: number
  end: number
  data: {
    text: string
    display?: string
  }
}

/**
 * 对齐官方 @deepseek-ai/dsh-message-quotes 的 UserText 切分规则。
 */
export const officialQuoteRule = {
  id: 'quote',
  order: -10,
  match(text: string, from: number): QuoteNodeMatch | undefined {
    for (const range of messageQuoteRanges(text)) {
      for (const start of [range.start - 2, range.start, range.end]) {
        if (start < from) continue
        if (start === range.start) {
          return {
            id: 'quote',
            start,
            end: range.end,
            data: { text: quoteTextOf(text.slice(start, range.end)) },
          }
        }
        if (text.slice(start, start + 2) === '\n\n') {
          return {
            id: 'text',
            start,
            end: start + 2,
            data: {
              text: '\n\n',
              display: ' ',
            },
          }
        }
      }
    }
    return undefined
  },
}

function OfficialQuoteIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg width={16} height={16} className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <g transform="translate(6.8 2.4)">
        <path d="M2.8125 0.583008L3.2002 1.16602C2.43912 1.6713 1.88491 2.41238 1.60547 3.25684H2.98926V6.70605H0V4.52148C1.96593e-05 2.70313 0.9109 1.00575 2.42578 0L2.8125 0.583008Z" fill="currentColor" />
        <path d="M7.50781 0.583008L7.89551 1.16602C7.13443 1.6713 6.58022 2.41238 6.30078 3.25684H7.68457V6.70605H4.69531V4.52148C4.69533 2.70313 5.60621 1.00575 7.12109 0L7.50781 0.583008Z" fill="currentColor" />
      </g>
    </svg>
  )
}

/**
 * 引用文本渲染组件：优先复用宿主原语 QuotePreview；老版本缺少时降级渲染为 1:1 官方链接样式并支持 HoverCard 预览全文。
 */
export function OfficialQuotePreview({ text }: { text: string }): React.JSX.Element {
  const HostQuotePreview = (primitives as Record<string, unknown>).QuotePreview as React.ComponentType<{ text: string }> | undefined
  if (typeof HostQuotePreview === 'function') {
    return <HostQuotePreview text={text} />
  }

  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
    check()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  const anchor = (
    <span className="btw-official-quote-node" data-quote-preview="" title={text}>
      <span className="btw-quote-marker" aria-hidden="true">
        <OfficialQuoteIcon className="btw-quote-icon" />
      </span>
      <span ref={textRef} className="btw-quote-text" data-quote-preview-text="">
        {text}
      </span>
    </span>
  )

  const HostHoverCard = (primitives as Record<string, unknown>).HoverCard as React.ComponentType<{
    inline?: boolean
    grouped?: boolean
    fitContent?: boolean
    openDelayMs?: number
    disabled?: boolean
    anchor: React.ReactNode
    content: React.ReactNode
  }> | undefined

  if (typeof HostHoverCard === 'function') {
    return (
      <HostHoverCard
        inline
        grouped
        fitContent
        openDelayMs={0}
        disabled={!isTruncated}
        anchor={anchor}
        content={
          <span className="btw-quote-popover-text" data-quote-popover="" aria-hidden="true">
            {text}
          </span>
        }
      />
    )
  }

  return anchor
}

/**
 * 安全向 uiConversation.userText 注册规则（避免重复注册已存在的官方规则导致崩溃）。
 */
export function safeRegisterUserTextRule(
  userText: { definitions?: Map<string, unknown>; has?: (id: string) => boolean; register?: (rule: unknown) => () => void } | undefined,
  rule: { id: string; order: number; match: (text: string, from: number) => unknown }
): (() => void) | undefined {
  if (!userText || typeof userText.register !== 'function') return undefined
  if (userText.definitions?.has(rule.id) || userText.has?.(rule.id)) return undefined
  try {
    return userText.register(rule)
  } catch {
    return undefined
  }
}

