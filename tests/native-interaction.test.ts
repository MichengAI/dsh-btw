// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NativeBtwAskAction,
  registerAskHandler,
  triggerAskModal,
  attachNativeAskButton,
} from '../src/client/NativeBtwAsk'
import { SelectionAsk } from '../src/client/SelectionAsk'
import { BubbleStore } from '../src/client/bubbles'
import { translate } from '../src/locales'

describe('NativeBtwAsk 适配官方选区交互规范与插槽', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(() => {
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('registerAskHandler 与 triggerAskModal 能跨组件派发打开旁问弹窗请求', () => {
    const handler = vi.fn()
    const unregister = registerAskHandler('session-1', handler)

    expect(triggerAskModal('session-2', '未匹配的文本')).toBe(false)
    expect(handler).not.toHaveBeenCalled()

    expect(triggerAskModal('session-1', '测试选中文本')).toBe(true)
    expect(handler).toHaveBeenCalledWith('测试选中文本')

    unregister()
    expect(triggerAskModal('session-1', '测试选中文本')).toBe(false)
  })

  it('NativeBtwAskAction 按钮点击后读取选中文本，触发旁问并关闭原生浮层', async () => {
    const dismiss = vi.fn()
    const clearSelection = vi.fn()
    const readText = vi.fn(() => '被划选的关键代码')
    const useSession = vi.fn((selector: (s: any) => boolean) => selector({ removed: false, subagent: null }))
    const targetHandler = vi.fn()
    registerAskHandler('session-x', targetHandler)

    const root = createRoot(container)
    await act(async () => {
      root.render(
        React.createElement(NativeBtwAskAction, {
          sessionId: 'session-x',
          dismiss,
          clearSelection,
          readText,
          useSession,
          t: translate('zh'),
        })
      )
    })

    const button = container.querySelector('button')!
    expect(button).not.toBeNull()
    expect(button.textContent).toBe('旁问')

    await act(async () => {
      button.click()
    })

    expect(readText).toHaveBeenCalled()
    expect(targetHandler).toHaveBeenCalledWith('被划选的关键代码')
    expect(clearSelection).toHaveBeenCalled()
    expect(dismiss).toHaveBeenCalled()

    root.unmount()
  })

  it('SelectionAsk 在 nativeSelection: true 时不自建 DOM mouseup 浮层，但能响应 triggerAskModal 弹出窗口', async () => {
    const store = new BubbleStore({ run: vi.fn(), close: vi.fn() })
    const scope = document.createElement('div')
    scope.setAttribute('data-conversation-scroll', '')
    scope.innerHTML = '<div data-chat-flow-kind="assistant-step"><p>正文内容</p></div>'
    document.body.append(scope)

    const root = createRoot(container)
    await act(async () => {
      root.render(
        React.createElement(SelectionAsk, {
          store,
          sessionId: 'session-native',
          t: translate('zh'),
          nativeSelection: true,
        })
      )
    })

    // 模拟划选触发 mouseup
    const p = scope.querySelector('p')!
    const range = document.createRange()
    range.selectNodeContents(p)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    await act(async () => {
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    // 确认没有自建的悬浮菜单
    expect(container.querySelector('.btw-selection-menu')).toBeNull()

    // 通过 triggerAskModal 唤起
    await act(async () => {
      triggerAskModal('session-native', '外部原生按钮传来的内容')
    })

    // 成功打开 Modal
    expect(container.querySelector('textarea, [data-btw-modal]')).not.toBeNull()
    expect(container.textContent).toContain('外部原生按钮传来的内容')

    root.unmount()
    scope.remove()
  })

  it('attachNativeAskButton 向官方 [data-text-interaction-surface] 自动追加「旁问」按钮并支持点击提问', async () => {
    const scope = document.createElement('div')
    scope.setAttribute('data-conversation-scroll', '')
    scope.innerHTML = '<div data-chat-flow-kind="assistant-step"><p>待旁问的片段</p></div>'
    document.body.append(scope)

    // 模拟官方选区浮层
    const surface = document.createElement('div')
    surface.setAttribute('data-text-interaction-surface', '')
    const quoteBtn = document.createElement('button')
    quoteBtn.className = 'official-quote-btn'
    quoteBtn.textContent = '引用文本'
    surface.append(quoteBtn)
    document.body.append(surface)

    const askTarget = vi.fn()
    registerAskHandler('session-official', askTarget)

    const detach = attachNativeAskButton(scope, 'session-official', translate('zh'))

    // 选中文本
    const p = scope.querySelector('p')!
    const range = document.createRange()
    range.selectNodeContents(p)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)

    // 此时 surface 中应已自动融入 [旁问] 按钮
    const btwBtn = surface.querySelector<HTMLButtonElement>('.btw-native-ask-button')
    expect(btwBtn).not.toBeNull()
    expect(btwBtn?.textContent).toBe('旁问')

    // 点击该融入按钮
    await act(async () => {
      btwBtn?.click()
    })

    expect(askTarget).toHaveBeenCalledWith('待旁问的片段')
    expect(surface.getAttribute('aria-hidden')).toBe('true')

    detach()
    surface.remove()
    scope.remove()
  })
})
