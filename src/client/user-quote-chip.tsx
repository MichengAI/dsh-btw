import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReferenceChip } from '@deepseek-ai/dsh-client-ui-primitives'
import { jumpToQuote } from './quotes'
import { translate, type BtwTranslate } from '../locales'
import { OfficialQuotePreview } from './official-quote'

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
  const items = node.data.items && node.data.items.length > 0
    ? node.data.items
    : [{ text: node.data.raw || node.data.label }]

  return (
    <span
      className="btw-official-quote-group"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '4px',
        margin: '2px 0',
        verticalAlign: 'middle',
        maxWidth: '100%',
      }}
    >
      {items.map((item, idx) => (
        <OfficialQuotePreview key={idx} text={item.text} />
      ))}
    </span>
  )
}
