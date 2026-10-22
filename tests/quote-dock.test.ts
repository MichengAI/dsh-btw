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
  expect(mount.querySelector('.btw-codex-pill')?.textContent).toContain('1 条引用')

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

it('弹窗内的 textarea 按 Enter 不触发主会话 QuoteDock 的合并与清空', async () => {
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
      text: '主会话挂着的引文',
      role: 'assistant',
      turnIndex: 1,
    })
  })

  // 创建一个模拟弹窗及其内部的 textarea
  const dialog = document.createElement('div')
  dialog.className = 'btw-selection-dialog btw-selection-modal'
  const dialogTextarea = document.createElement('textarea')
  dialog.append(dialogTextarea)
  document.body.append(dialog)

  dialogTextarea.focus()
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    dialogTextarea.dispatchEvent(enterEvent)
  })

  // 验证：主会话草稿绝不能被污染，quotes 也不能被清空
  expect(mockSetDraft).not.toHaveBeenCalled()
  expect(store.getQuotes('session-a')).toHaveLength(1)
  dialog.remove()
})

it('处于 submitting/adjudicating 状态时，按 Enter 或展开草稿不合并且不清空 quotes', async () => {
  let submittingPhase = 'submitting'
  const busyInput = {
    state: { getSnapshot: () => ({ draft: mockDraft, phase: submittingPhase }) },
    setDraft: mockSetDraft,
    focus: mockFocus,
  }

  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: busyInput,
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '不可丢失的引文',
      role: 'assistant',
      turnIndex: 1,
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

  // 提交中禁止改写，且引用绝不能丢失
  expect(mockSetDraft).not.toHaveBeenCalled()
  expect(store.getQuotes('session-a')).toHaveLength(1)
})

it('草稿为空时按 Enter 不执行合并，不清空 store 中的 quotes', async () => {
  mockDraft = '   ' // 空白草稿
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
      text: '引文',
      role: 'assistant',
      turnIndex: 1,
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

  // 不合并、不清空
  expect(mockSetDraft).not.toHaveBeenCalled()
  expect(store.getQuotes('session-a')).toHaveLength(1)
})
