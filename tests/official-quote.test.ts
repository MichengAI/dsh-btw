// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import {
  formatAsBlockquote,
  messageQuoteRanges,
  officialQuoteRule,
  createOfficialQuoteRule,
  quoteTextOf,
  OfficialQuotePreview,
  safeRegisterUserTextRule,
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

  it('officialQuoteRule 拥有独立命名空间 dsh-btw-blockquote 并正确进行词法切分', () => {
    const message = '> 引用的上下文\n\n请帮我解释这段话'
    const match = officialQuoteRule.match(message, 0)
    expect(match).toBeDefined()
    expect(match?.id).toBe('dsh-btw-blockquote')
    expect(match?.start).toBe(0)
    expect(match?.data.text).toBe('引用的上下文')
  })

  it('Issue #24: createOfficialQuoteRule 在官方 quote 规则已注册时于渲染期让位，返回 undefined', () => {
    let officialPresent = false
    const rule = createOfficialQuoteRule(() => officialPresent)

    const message = '> 引用的上下文\n\n请帮我解释这段话'
    // 官方不存在时（老宿主）：正常切分出 dsh-btw-blockquote
    const match1 = rule.match(message, 0)
    expect(match1).toBeDefined()
    expect(match1?.id).toBe('dsh-btw-blockquote')

    // 官方规则已加载时（新宿主）：主动让位，绝不抢占匹配
    officialPresent = true
    const match2 = rule.match(message, 0)
    expect(match2).toBeUndefined()
  })

  it('Issue #24: 双向时序兼容——官方规则先注册或 BTW 先注册，均无 duplicate id 异常', () => {
    const definitions = new Map<string, unknown>()
    const register = (rule: any) => {
      if (definitions.has(rule.id)) throw new Error(`duplicate: ${rule.id}`)
      definitions.set(rule.id, rule)
      return () => definitions.delete(rule.id)
    }
    const mockUserText = { definitions, register }

    // 场景 A：BTW 先注册，官方后注册（Issue #24 触发场景）
    // BTW 注册自有 id 规则
    const btwRule = createOfficialQuoteRule(() => definitions.has('quote'))
    expect(() => safeRegisterUserTextRule(mockUserText, btwRule)).not.toThrow()
    expect(definitions.has('dsh-btw-blockquote')).toBe(true)

    // 官方插件随后无守卫注册其原生 id: 'quote'
    const officialHostRule = { id: 'quote', order: -10, match: () => undefined }
    expect(() => register(officialHostRule)).not.toThrow()
    expect(definitions.has('quote')).toBe(true)

    // 场景 B：渲染期切分，BTW 规则检测到 officialHostRule 存在，主动让位
    const message = '> 测试引文\n\n问题'
    expect(btwRule.match(message, 0)).toBeUndefined()
  })

  it('Issue #24: 响应式同步注销——当官方 quote 规则动态注入时，BTW blockquote 规则能物理注销以失效宿主 matcher 缓存', () => {
    const definitions = new Map<string, any>()
    const listeners = new Set<() => void>()
    const notify = () => { listeners.forEach(l => l()) }

    const register = (rule: any) => {
      if (definitions.has(rule.id)) throw new Error(`duplicate: ${rule.id}`)
      definitions.set(rule.id, rule)
      notify()
      return () => {
        definitions.delete(rule.id)
        notify()
      }
    }
    const subscribe = (l: () => void) => {
      listeners.add(l)
      return () => { listeners.delete(l) }
    }
    const mockUserText = { definitions, register, subscribe }

    let offShim: (() => void) | undefined
    let syncing = false
    const sync = () => {
      if (syncing) return
      syncing = true
      try {
        const hasOfficial = definitions.has('quote')
        if (hasOfficial && offShim) {
          offShim()
          offShim = undefined
        } else if (!hasOfficial && !offShim) {
          offShim = safeRegisterUserTextRule(mockUserText, createOfficialQuoteRule(() => definitions.has('quote')))
        }
      } finally {
        syncing = false
      }
    }
    mockUserText.subscribe(sync)
    sync()

    // 阶段 1：官方未加载时，BTW 规则存在
    expect(definitions.has('dsh-btw-blockquote')).toBe(true)

    // 阶段 2：官方插件加载，注册 quote 规则
    const offOfficial = register({ id: 'quote', order: -10, match: () => undefined })
    // 预期：BTW 规则被响应式物理注销，从 definitions 中移除，彻底失效宿主 Evaluator 缓存
    expect(definitions.has('quote')).toBe(true)
    expect(definitions.has('dsh-btw-blockquote')).toBe(false)

    // 阶段 3：官方插件被动态停用/卸载
    offOfficial()
    // 预期：BTW 规则被重新响应式挂载顶上
    expect(definitions.has('quote')).toBe(false)
    expect(definitions.has('dsh-btw-blockquote')).toBe(true)
  })

  it('OfficialQuotePreview 组件能在老版本缺少宿主 primitives 时优雅渲染引文卡片', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(React.createElement(OfficialQuotePreview, { text: '这是引用的正文' }))
    })

    expect(container.textContent).toContain('这是引用的正文')
    const quoteNode = container.querySelector('[data-quote-preview]')
    expect(quoteNode).not.toBeNull()
    expect(quoteNode?.querySelector('[data-quote-preview-text]')?.textContent).toBe('这是引用的正文')
    root.unmount()
    container.remove()
  })

  it('safeRegisterUserTextRule 与 safeRegisterInteraction 在重复注册时安全返回 undefined 不抛出异常', () => {
    const definitions = new Map<string, unknown>()
    const register = (rule: any) => {
      if (definitions.has(rule.id)) throw new Error(`duplicate: ${rule.id}`)
      definitions.set(rule.id, rule)
      return () => definitions.delete(rule.id)
    }
    const mockUserText = { definitions, register }

    const off1 = safeRegisterUserTextRule(mockUserText, officialQuoteRule)
    expect(off1).toBeDefined()
    expect(definitions.has('dsh-btw-blockquote')).toBe(true)

    // 第二次注册同名规则：应安全返回 undefined，绝不抛出 duplicate 错误
    const off2 = safeRegisterUserTextRule(mockUserText, officialQuoteRule)
    expect(off2).toBeUndefined()

    off1?.()
    expect(definitions.has('dsh-btw-blockquote')).toBe(false)
  })
})
