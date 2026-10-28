// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import {
  formatAsBlockquote,
  messageQuoteRanges,
  officialQuoteRule,
  quoteTextOf,
  OfficialQuotePreview,
} from '../src/client/official-quote'

describe('official-quote 对齐官方 Markdown blockquote 识别与格式化', () => {
  it('formatAsBlockquote 将单行与多行文本正确转换为标准 Markdown 引用格式', () => {
    expect(formatAsBlockquote('Hello world')).toBe('> Hello world')
    expect(formatAsBlockquote('Line 1\nLine 2\nLine 3')).toBe('> Line 1\n> Line 2\n> Line 3')
    expect(formatAsBlockquote('  Line with space  ')).toBe('> Line with space')
    expect(formatAsBlockquote('Line 1\r\nLine 2')).toBe('> Line 1\n> Line 2')
  })

  it('quoteTextOf 正确剥离每行开头的 > 符号与前导空格', () => {
    expect(quoteTextOf('> Hello world')).toBe('Hello world')
    expect(quoteTextOf('> Line 1\n> Line 2')).toBe('Line 1\nLine 2')
    expect(quoteTextOf('   >    Indented quote   ')).toBe('   Indented quote   ')
    expect(quoteTextOf('> Line 1\r\n> Line 2')).toBe('Line 1\nLine 2')
  })

  it('messageQuoteRanges 准确识别消息中的引用区间', () => {
    const message = '前面普通文本\n\n> 引用第一行\n> 引用第二行\n\n后面普通问题'
    const ranges = messageQuoteRanges(message)
    expect(ranges).toHaveLength(1)
    const range = ranges[0]!
    expect(message.slice(range.start, range.end)).toBe('> 引用第一行\n> 引用第二行')
    expect(quoteTextOf(message.slice(range.start, range.end))).toBe('引用第一行\n引用第二行')
  })

  it('officialQuoteRule 正确进行词法切分，并提取 quote 节点', () => {
    const message = '> 引用的上下文\n\n请帮我解释这段话'
    const match = officialQuoteRule.match(message, 0)
    expect(match).toBeDefined()
    expect(match?.id).toBe('quote')
    expect(match?.start).toBe(0)
    expect(match?.data.text).toBe('引用的上下文')
  })

  it('OfficialQuotePreview 组件能在老版本缺少宿主 primitives 时优雅渲染引文卡片', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(OfficialQuotePreview, { text: '这是引用的正文' }))
    })

    expect(container.textContent).toContain('这是引用的正文')
    const blockquote = container.querySelector('blockquote, .btw-quote-preview')
    expect(blockquote).not.toBeNull()
    root.unmount()
    container.remove()
  })
})
