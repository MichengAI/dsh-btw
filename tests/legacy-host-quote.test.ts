// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { SelectionAsk } from '../src/client/SelectionAsk'
import { OfficialQuotePreview } from '../src/client/official-quote'
import { BubbleStore } from '../src/client/bubbles'
import { QuoteStore } from '../src/client/quotes'
import { translate } from '../src/locales'

describe('老版本宿主（无官方 quotes 插件与 insertQuote）1:1 体验与降级测试', () => {
  let scope: HTMLDivElement
  let mount: HTMLDivElement
  let root: Root
  let store: BubbleStore
  let quoteStore: QuoteStore

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
    scope.innerHTML = '<div data-chat-flow-kind="assistant-step"><p>老版本宿主气泡里的待选文字</p></div>'

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
    quoteStore = new QuoteStore()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    scope.remove()
    window.getSelection()?.removeAllRanges()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('老版本宿主：缺少 primitives.QuotePreview 时，OfficialQuotePreview 1:1 输出官方带图标的链接胶囊 DOM 结构', () => {
    act(() => {
      root.render(React.createElement(OfficialQuotePreview, { text: '老宿主气泡中的引文' }))
    })

    const node = mount.querySelector('.btw-official-quote-node')
    expect(node).not.toBeNull()
    expect(node?.getAttribute('data-quote-preview')).toBe('')

    // 校验官方同款双引号图标
    const icon = node?.querySelector('.btw-quote-marker svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16')

    // 校验引文文本
    const textSpan = node?.querySelector('[data-quote-preview-text]')
    expect(textSpan).not.toBeNull()
    expect(textSpan?.textContent).toBe('老宿主气泡中的引文')
  })

  it('老版本宿主输入框：无 insertQuote 时，点击「引用文本」通过 insertReference 插入原子链接胶囊，正文不被 Markdown 拍平', async () => {
    let capturedRef: any = null
    let capturedSpan: any = null
    const focus = vi.fn()
    const mockLegacyInput = {
      state: {
        getSnapshot: () => ({
          draft: '用户当前正在编写的问题草稿',
          draftRev: 5,
          phase: 'plain',
        }),
      },
      setDraft: vi.fn(),
      focus,
      insertReference: vi.fn((ref, span) => {
        capturedRef = ref
        capturedSpan = span
        return true
      }),
    }

    await act(async () => {
      root.render(
        React.createElement(SelectionAsk, {
          store,
          quoteStore,
          sessionId: 'legacy-session',
          t: translate(),
          input: mockLegacyInput,
        })
      )
    })

    // 模拟选区划选
    const p = scope.querySelector('p')!
    const range = document.createRange()
    range.setStart(p.firstChild!, 0)
    range.setEnd(p.firstChild!, 8)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    await act(async () => {
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
    })

    // 验证弹出的自建菜单是官方药丸样式
    const quoteBtn = Array.from(mount.querySelectorAll('button')).find(b => b.textContent?.trim() === '引用文本')
    expect(quoteBtn).not.toBeUndefined()

    // 点击「引用文本」
    await act(async () => {
      quoteBtn!.click()
    })

    // 核心断言：
    // 1. 调用了 insertReference
    expect(mockLegacyInput.insertReference).toHaveBeenCalled()
    expect(capturedRef.source).toBe('dsh-btw-quote')
    expect(capturedRef.label).toContain('引用')
    // 2. 插入位置在现有草稿末尾
    expect(capturedSpan.start).toBe('用户当前正在编写的问题草稿'.length)
    // 3. 绝不能调用 setDraft 拍平为纯文本 Markdown！
    expect(mockLegacyInput.setDraft).not.toHaveBeenCalled()
    // 4. 输入框重新聚焦
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('极端老版本（既无 insertQuote 也无 insertReference）才安全兜底为 Markdown blockquote setDraft', async () => {
    const focus = vi.fn()
    const mockBareInput = {
      state: {
        getSnapshot: () => ({
          draft: '旧草稿',
          phase: 'plain',
        }),
      },
      setDraft: vi.fn(),
      focus,
    }

    await act(async () => {
      root.render(
        React.createElement(SelectionAsk, {
          store,
          quoteStore,
          sessionId: 'bare-session',
          t: translate(),
          input: mockBareInput,
        })
      )
    })

    const p = scope.querySelector('p')!
    const range = document.createRange()
    range.selectNodeContents(p)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    await act(async () => {
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }))
    })

    const quoteBtn = Array.from(mount.querySelectorAll('button')).find(b => b.textContent?.trim() === '引用文本') as HTMLButtonElement | undefined
    await act(async () => {
      quoteBtn?.click()
    })

    expect(mockBareInput.setDraft).toHaveBeenCalledWith('旧草稿\n\n> 老版本宿主气泡里的待选文字\n\n')
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
