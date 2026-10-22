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

it('草稿为空时按 Enter 依然按照 Codex 规范执行发送并清空 store 中的 quotes', async () => {
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

  // 对齐 Codex：输入框为空时依然正常将引文提交并清空药丸
  expect(mockSetDraft).toHaveBeenCalledTimes(1)
  expect(store.getQuotes('session-a')).toHaveLength(0)
})

it('点击宿主真实的 InputBar 发送按钮（type="button", aria-label="发送消息"）能够正确触发合并并清空 quotes', async () => {
  mockDraft = '要发送的真实问题'
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
      text: '待合并的引文',
      role: 'assistant',
      turnIndex: 1,
    })
  })

  // 创建一个模拟宿主真实 InputBar 的 primary 按钮（type="button"，无 type="submit"）
  const composerCard = document.createElement('div')
  composerCard.setAttribute('data-composer-card', 'true')
  const sendButton = document.createElement('button')
  sendButton.type = 'button'
  sendButton.className = 'InputBar_primary__mock'
  sendButton.setAttribute('aria-label', '发送消息')
  composerCard.append(sendButton)
  document.body.append(composerCard)

  act(() => {
    sendButton.click()
  })

  expect(mockSetDraft).toHaveBeenCalled()
  expect(mockDraft).toContain('待合并的引文')
  expect(mockDraft).toContain('要发送的真实问题')
  expect(store.getQuotes('session-a')).toHaveLength(0)
  composerCard.remove()
})

it('点击宿主停止生成按钮（aria-label="停止生成"，具备 primary 样式）不触发合并，不清空 quotes', async () => {
  mockDraft = '草稿内容'
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
      text: '正在生成的背景引文',
      role: 'assistant',
      turnIndex: 1,
    })
  })

  // 模拟宿主的停止按钮：同样具备 primary 类名，但 aria-label 为停止生成
  const composerCard = document.createElement('div')
  composerCard.setAttribute('data-composer-card', 'true')
  const stopButton = document.createElement('button')
  stopButton.type = 'button'
  stopButton.className = 'InputBar_primary__mock'
  stopButton.setAttribute('aria-label', '停止生成')
  composerCard.append(stopButton)
  document.body.append(composerCard)

  act(() => {
    stopButton.click()
  })

  // 停止生成绝不能触发合并与清空
  expect(mockSetDraft).not.toHaveBeenCalled()
  expect(store.getQuotes('session-a')).toHaveLength(1)
  composerCard.remove()
})

it('当宿主支持 insertReference 且存在结构化 occurrences 时，回车发送不拍平草稿，保留纯净用户正文', async () => {
  const insertedRefs: any[] = []
  mockDraft = '我的提问'
  const occurrences = [{ source: 'dsh-btw-quote', ref: '{"text":"引用"}' }]
  const structuredInput = {
    state: { getSnapshot: () => ({ draft: mockDraft, phase: 'plain', occurrences }) },
    setDraft: mockSetDraft,
    focus: mockFocus,
    insertReference: vi.fn((ref) => {
      insertedRefs.push(ref)
      return true
    }),
  }

  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: structuredInput as any,
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '已转化为 Mention 的引文',
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

  // 关键断言：setDraft 绝不能被调用（不把草稿拍平成大段 Markdown）！
  expect(mockSetDraft).not.toHaveBeenCalled()
  // quotes 成功提交清理
  expect(store.getQuotes('session-a')).toHaveLength(0)
})

it('对齐 Codex：当输入框完全为空时，按回车依然能够正常发送引文并清空药丸', async () => {
  mockDraft = ''
  const mockSubmit = vi.fn()
  const emptyInput = {
    state: { getSnapshot: () => ({ draft: '', phase: 'plain' }) },
    setDraft: mockSetDraft,
    focus: mockFocus,
    submit: mockSubmit,
  }

  await act(async () => {
    root.render(React.createElement(QuoteDock, {
      store,
      sessionId: 'session-a',
      t: translate('zh'),
      input: emptyInput as any,
    }))
  })

  act(() => {
    store.addQuote('session-a', {
      text: '只引用文本，输入框一字没打',
      role: 'assistant',
      turnIndex: 2,
    })
  })

  expect(store.getQuotes('session-a')).toHaveLength(1)

  inputElement.value = ''
  inputElement.focus()
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    inputElement.dispatchEvent(enterEvent)
  })

  // 关键断言：setDraft 被调用，且包含引文提示词
  expect(mockSetDraft).toHaveBeenCalledTimes(1)
  expect(mockSetDraft.mock.calls[0]?.[0]).toContain('只引用文本，输入框一字没打')
  // 不包含尾部的空提问段落
  expect(mockSetDraft.mock.calls[0]?.[0]).not.toContain('## 用户需求与指示：')
  // 药丸被清空
  expect(store.getQuotes('session-a')).toHaveLength(0)
})
