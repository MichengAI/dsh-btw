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

/**
 * 引用文本渲染组件：优先复用宿主原语 QuotePreview；老版本缺少时降级渲染。
 */
export function OfficialQuotePreview({ text }: { text: string }): React.JSX.Element {
  const HostQuotePreview = (primitives as Record<string, unknown>).QuotePreview as React.ComponentType<{ text: string }> | undefined
  if (typeof HostQuotePreview === 'function') {
    return <HostQuotePreview text={text} />
  }

  return (
    <blockquote className="btw-official-quote-preview">
      {text}
    </blockquote>
  )
}
