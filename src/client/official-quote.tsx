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
  id: 'dsh-btw-blockquote' | 'quote' | 'text'
  start: number
  end: number
  data: {
    text: string
    display?: string
  }
}

/**
 * 构造用于降级承接 Markdown blockquote 的 UserText 切分规则。
 * 拥有自有命名空间 `dsh-btw-blockquote`，彻底避免抢占官方 `quote` 规则 ID。
 * 并在渲染期动态让位：若宿主已加载官方 `quote` 规则，则返回 undefined 放弃匹配，由官方规则渲染。
 */
export function createOfficialQuoteRule(isOfficialPresent?: () => boolean) {
  return {
    id: 'dsh-btw-blockquote' as const,
    order: -10,
    match(text: string, from: number): QuoteNodeMatch | undefined {
      // 渲染期让位守护：只要官方 quote 规则已注册，直接让位，时序完全解耦
      if (isOfficialPresent?.()) {
        return undefined
      }

      for (const range of messageQuoteRanges(text)) {
        for (const start of [range.start - 2, range.start, range.end]) {
          if (start < from) continue
          if (start === range.start) {
            return {
              id: 'dsh-btw-blockquote',
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
}

/**
 * 默认 blockquote 切分规则实例（老宿主无官方插件时降级承接）。
 */
export const officialQuoteRule = createOfficialQuoteRule()

/**
 * 引用文本渲染组件：优先复用宿主原语 QuotePreview；老版本缺少时降级渲染为纯文本节点。
 */
export function OfficialQuotePreview({ text }: { text: string }): React.JSX.Element {
  const HostQuotePreview = (primitives as Record<string, unknown>).QuotePreview as React.ComponentType<{ text: string }> | undefined
  if (typeof HostQuotePreview === 'function') {
    return <HostQuotePreview text={text} />
  }
  return (
    <span className="btw-official-quote-node" data-quote-preview="" title={text}>
      {text}
    </span>
  )
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

