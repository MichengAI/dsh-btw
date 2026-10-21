// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QuoteDock } from '../src/client/QuoteDock'
import { QuoteStore } from '../src/client/quotes'
import { translate } from '../src/locales'

let root: Root
let mount: HTMLDivElement
let store: QuoteStore
let mockDraft = ''
let mockFocus = vi.fn()
let mockSetDraft = vi.fn((text: string) => { mockDraft = text })
let inputElement: HTMLTextAreaElement

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mount = document.createElement('div')
  document.body.append(mount)
  root = createRoot(mount)
  store = new QuoteStore()
  mockDraft = '用户打的问题'
  mockSetDraft.mockClear()
  mockFocus.mockClear()

  inputElement = document.createElement('textarea')
  inputElement.setAttribute('data-dsh-composer-input', '')
  inputElement.value = mockDraft
  document.body.append(inputElement)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  mount.remove()
  inputElement.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function getDraftInput() {
  return {
    state: { getSnapshot: () => ({ draft: mockDraft, phase: 'plain' }) },
    setDraft: mockSetDraft,
    focus: mockFocus,
  }
}

it('没有引用时 QuoteDock 不渲染任何内容', async () => {
  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: getDraftInput(),
    }))
  })
  expect(mount.innerHTML).toBe('')
})

it('添加注释后渲染 Codex 胶囊药丸，支持展开 Popover 与单条删除', async () => {
  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: getDraftInput(),
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '引用代码片段 const a = 1',
      role: 'assistant',
      turnIndex: 1,
    })
  })

  expect(mount.querySelector('.btw-quote-dock')).not.toBeNull()
  expect(mount.querySelector('.btw-codex-pill')?.textContent).toContain('1 条注释')

  // 点击药丸展开 Popover
  act(() => {
    ;(mount.querySelector('.btw-codex-pill') as HTMLElement).click()
  })
  expect(mount.querySelector('.btw-codex-popover')).not.toBeNull()
  expect(mount.querySelector('.btw-codex-comment-card')?.textContent).toContain('const a = 1')

  // 测试点击卡片内的单条删除
  const removeBtn = mount.querySelector('.btw-codex-card-remove') as HTMLButtonElement
  expect(removeBtn).not.toBeNull()
  act(() => { removeBtn.click() })
  expect(store.getQuotes('session-a')).toHaveLength(0)
  expect(mount.innerHTML).toBe('')
})

it('点击“展开到输入框”将注释拍平写入 draft 并清空 store', async () => {
  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: getDraftInput(),
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '第一行引用\n第二行引用',
      role: 'assistant',
      turnIndex: 2,
    })
  })

  // 展开 Popover
  act(() => {
    ;(mount.querySelector('.btw-codex-pill') as HTMLElement).click()
  })

  const expandBtn = [...mount.querySelectorAll('button')].find(b => b.textContent?.includes('展开到输入框'))
  expect(expandBtn).toBeDefined()
  act(() => { expandBtn!.click() })

  expect(mockSetDraft).toHaveBeenCalled()
  expect(mockDraft).toContain('> [来自助手 · 第 2 轮]:')
  expect(mockDraft).toContain('用户打的问题')
  expect(store.getQuotes('session-a')).toHaveLength(0)
})

it('在输入框敲击 Enter 时自动合并引用并清空 store', async () => {
  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: getDraftInput(),
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '待发送的引文',
      role: 'assistant',
      turnIndex: 3,
    })
  })

  inputElement.focus()
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    inputElement.dispatchEvent(enterEvent)
  })

  expect(mockSetDraft).toHaveBeenCalled()
  expect(mockDraft).toContain('> [来自助手 · 第 3 轮]:')
  expect(mockDraft).toContain('> 待发送的引文')
  expect(mockDraft).toContain('用户打的问题')
  expect(store.getQuotes('session-a')).toHaveLength(0)
})
