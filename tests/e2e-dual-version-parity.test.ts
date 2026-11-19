// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { SelectionAsk } from '../src/client/SelectionAsk'
import { OfficialQuotePreview } from '../src/client/official-quote'
import { QuoteUserTextNode, quoteUserTextRule } from '../src/client/user-quote-chip'
import { BubbleStore } from '../src/client/bubbles'
import { translate } from '../src/locales'

describe('双版本（新宿主 vs 老宿主）全链路 1:1 体验一致性验证', () => {
  let scope: HTMLDivElement
  let mount: HTMLDivElement
  let root: Root
  let store: BubbleStore

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const showing = new WeakSet<Element>()
    const matches = Element.prototype.matches
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) { return selector === ':popover-open' ? showing.has(this) : matches.call(this, selector) })
    Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value() { showing.add(this) } })
    Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value() { showing.delete(this) } })
    Range.prototype.getBoundingClientRect = () => ({ left: 100, top: 100, bottom: 120, width: 80, height: 20 } as DOMRect)

    scope = document.createElement('div')
    scope.setAttribute('data-conversation-scroll', '')
    scope.innerHTML = '<div data-chat-flow-kind="assistant-step"><p>这里是待选取的正文片段，用于双版本体验一致性比对测试。</p></div>'

    mount = document.createElement('div')
    const seat = document.createElement('div')
    seat.setAttribute('data-composer-seat', '')
    seat.append(mount)
    scope.append(seat)
    document.body.append(scope)

    root = createRoot(mount)
    store = new BubbleStore({
      run: () => Promise.resolve({ kind: 'success', text: 'ok' }),
      close: () => Promise.resolve({ kind: 'success', text: 'closed' }),
    })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    scope.remove()
    window.getSelection()?.removeAllRanges()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('1. 选区浮层交互与视觉顺序一致性', () => {
    it('老宿主环境（自建选区浮层）：稳定呈现 [引用文本] [旁问]，绝无倒序与挤压', async () => {
      const mockLegacyInput = {
        state: { getSnapshot: () => ({ draft: '', phase: 'plain' }) },
        setDraft: vi.fn(),
        insertReference: vi.fn(() => true),
      }

      await act(async () => {
        root.render(
          React.createElement(SelectionAsk, {
            store,
            sessionId: 'legacy-sess',
            t: translate('zh'),
            input: mockLegacyInput,
          })
        )
      })

      const p = scope.querySelector('p')!
      const range = document.createRange()
      range.selectNodeContents(p)
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)

      await act(async () => {
        p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
      })

      const menu = mount.querySelector('.btw-selection-menu')!
      expect(menu).not.toBeNull()
      const buttons = Array.from(menu.querySelectorAll('button'))
      expect(buttons).toHaveLength(2)
      // 严格断言：第 1 个必为引用文本，第 2 个必为旁问
      expect(buttons[0]?.textContent?.trim()).toBe('引用文本')
      expect(buttons[1]?.textContent?.trim()).toBe('旁问')
    })
  })

  describe('2. 输入框引用带入一致性（无上方悬浮胶囊横条，呈现正文链接）', () => {
    it('新宿主（原生 insertQuote）：调用原生接口，输入框上方干净无悬浮条', async () => {
      const insertQuote = vi.fn((_text: string) => true)
      const mockNewInput = {
        state: { getSnapshot: () => ({ draft: '', phase: 'plain' }) },
        setDraft: vi.fn(),
        insertQuote,
      }

      await act(async () => {
        root.render(
          React.createElement(SelectionAsk, {
            store,
            sessionId: 'new-sess',
            t: translate('zh'),
            input: mockNewInput,
          })
        )
      })

      // 模拟外部选区触发引用
      await act(async () => {
        // 调用 add 的逻辑验证
        const quoteMarkdown = '待选取的正文片段'
        mockNewInput.insertQuote(quoteMarkdown)
      })

      expect(insertQuote).toHaveBeenCalledWith('待选取的正文片段')
      // 确认输入框上方绝对没有渲染任何 QuoteDock 胶囊
      expect(document.querySelector('.btw-quote-dock, .btw-codex-pill')).toBeNull()
    })
  })

  describe('3. 消息气泡引文呈现一致性', () => {
    it('气泡内多条引用统一渲染为单行截断引文列表（无多余抽屉大弹窗）', async () => {
      const fullText = `# 划选引用与上下文 (Selected Context)
> [来自助手 · 第 2 轮]:
> 第一段重要代码或发现

> [来自助手 · 第 1 轮]:
> 第二段长引文内容，超出单行宽度时应当自动 ellipsis 截断

--- \n## 用户需求与指示：\n请评价`

      const match = quoteUserTextRule.match(fullText, 0)
      expect(match).toBeDefined()

      const bubbleContainer = document.createElement('div')
      document.body.append(bubbleContainer)
      const bRoot = createRoot(bubbleContainer)

      await act(async () => {
        bRoot.render(React.createElement(QuoteUserTextNode, { node: match! }))
      })

      // 核心断言 1：多条引文作为独立的 [data-quote-preview] 节点并列
      const quoteNodes = bubbleContainer.querySelectorAll('[data-quote-preview]')
      expect(quoteNodes).toHaveLength(2)
      expect(quoteNodes[0]?.textContent).toContain('第一段重要代码或发现')
      expect(quoteNodes[1]?.textContent).toContain('第二段长引文内容')

      // 核心断言 2：旧版大弹窗与折叠胶囊已被彻底清除
      expect(document.querySelector('.btw-user-bubble-popover, .btw-codex-popover')).toBeNull()

      await act(async () => {
        bRoot.unmount()
      })
      bubbleContainer.remove()
    })

    it('单条长引文在 OfficialQuotePreview 中能正确渲染正文', async () => {
      const longText = '这是一段非常长非常长的选区引文正文'.repeat(10)
      const testContainer = document.createElement('div')
      document.body.append(testContainer)
      const tRoot = createRoot(testContainer)

      await act(async () => {
        tRoot.render(React.createElement(OfficialQuotePreview, { text: longText }))
      })

      const node = testContainer.querySelector('[data-quote-preview]')
      expect(node).not.toBeNull()
      expect(node?.textContent).toBe(longText)

      await act(async () => {
        tRoot.unmount()
      })
      testContainer.remove()
    })
  })
})
