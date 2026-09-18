// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SelectionAsk } from '../src/client/SelectionAsk'
import { BubbleDock } from '../src/client/BubbleView'
import { BubbleStore } from '../src/client/bubbles'
import { translate } from '../src/locales'

let root: Root
let scope: HTMLDivElement
let mount: HTMLDivElement
let store: BubbleStore
const add = vi.fn()
const run = vi.fn(async () => ({ kind: 'success' as const, text: '引用解释' }))
const close = vi.fn(async () => ({ kind: 'success' as const, text: '' }))

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.open = true } })
  const showing = new WeakSet<Element>()
  const matches = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) { return selector === ':popover-open' ? showing.has(this) : matches.call(this, selector) })
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value() { showing.add(this) } })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value() { showing.delete(this) } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.open = false } })
  Range.prototype.getBoundingClientRect = () => ({ left: 100, top: 100, bottom: 120, width: 80, height: 20 } as DOMRect)
  scope = document.createElement('div')
  scope.setAttribute('data-conversation-scroll', '')
  scope.innerHTML = '<div data-chat-flow-kind="assistant-step"><p>引用中的原始正文</p></div>'
  mount = document.createElement('div')
  const seat = document.createElement('div')
  seat.setAttribute('data-composer-seat', '')
  seat.append(mount)
  scope.append(seat)
  document.body.append(scope)
  root = createRoot(mount)
  run.mockClear(); close.mockClear(); add.mockClear()
  store = new BubbleStore({ run, close })
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(SelectionAsk, { store, sessionId: 'session-a', t: translate(), addToConversation: add }),
    React.createElement(BubbleDock, { store, sessionId: 'session-a', t: translate() }))))
})
afterEach(async () => {
  await act(async () => { await store.dispose(); root.unmount() })
  scope.remove()
  window.getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function open(shiftKey = false) {
  const paragraph = scope.querySelector('p')!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
  const event = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 100, clientY: 100, shiftKey })
  await act(async () => { paragraph.dispatchEvent(event) })
  return event
}
async function click(text: string) {
  const button = [...mount.querySelectorAll('button')].find(button => button.textContent === text)!
  expect(button).toBeTruthy()
  await act(async () => button.click())
}

it('划词横条到快捷解释固定引用，发送至原会话并以折叠引用展示', async () => {
  expect((await open()).defaultPrevented).toBe(false)
  scope.querySelector('p')!.textContent = '流式更新'
  await click('旁问')
  expect(document.activeElement?.tagName).toBe('TEXTAREA')
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')!.style.left).toBe('')
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')!.style.top).toBe('')
  await click('解释一下')
  expect(run).toHaveBeenCalledWith('session-a', expect.any(String), '解释一下', expect.any(AbortSignal), '引用中的原始正文')
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  expect(mount.querySelector('.btw-bubble blockquote')?.textContent).toBe('引用中的原始正文')
  expect(mount.querySelector('.btw-bubble details')?.hasAttribute('open')).toBe(false)
  expect(mount.querySelector('.btw-answer')?.textContent).toBe('引用解释')
})

it('Esc 取消不发送请求；卸载移除事件监听', async () => {
  expect((await open(true)).defaultPrevented).toBe(false)
  await open()
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  expect(run).not.toHaveBeenCalled()
  await act(async () => root.render(null))
  expect((await open()).defaultPrevented).toBe(false)
})

it('自定义问题按 Enter 发送，输入法组合输入和 Shift Enter 不提交', async () => {
  await open(); await click('旁问')
  const textarea = mount.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '为什么这样写？')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  for (const extra of [{ isComposing: true }, { shiftKey: true }]) {
    await act(async () => { textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ...extra })) })
  }
  expect(run).not.toHaveBeenCalled()
  await act(async () => { textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })) })
  expect(run).toHaveBeenCalledWith('session-a', expect.any(String), '为什么这样写？', expect.any(AbortSignal), '引用中的原始正文')
})

it('接收失败保留引用和草稿，不重复发送；超长引用不截断', async () => {
  const ask = vi.spyOn(store, 'ask').mockRejectedValue(new Error('容量已满'))
  await open(); await click('旁问'); await click('解释一下')
  expect(mount.querySelector('[role="alert"]')?.textContent).toBe('容量已满')
  expect(mount.querySelector('blockquote')?.textContent).toBe('引用中的原始正文')
  ask.mockRestore()
  await click('取消')
  scope.querySelector('p')!.textContent = '字'.repeat(8001)
  await open(); await click('旁问')
  const explain = [...mount.querySelectorAll('button')].find(button => button.textContent === '解释一下')!
  expect(explain.disabled).toBe(true)
  expect(mount.querySelector('blockquote')?.textContent?.length).toBe(8001)
  expect(run).not.toHaveBeenCalled()
})

it('正文滚动、窗口失焦和隐藏会话关闭菜单，已打开的提问框不因失焦丢失', async () => {
  let changed!: IntersectionObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { changed = callback }
    observe() {}
    disconnect = disconnect
  })
  await open()
  await act(async () => { scope.dispatchEvent(new Event('scroll')) })
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  await open()
  await act(async () => { window.dispatchEvent(new Event('blur')) })
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  await open(); await click('旁问')
  await act(async () => { window.dispatchEvent(new Event('blur')) })
  expect(mount.querySelector('textarea')).not.toBeNull()
  await act(async () => { changed([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver) })
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  expect(disconnect).toHaveBeenCalled()
  expect(run).not.toHaveBeenCalled()
})

it('添加引用不发送，右键保持原生，侧边栏选区不触发正文工具条', async () => {
  await open()
  await click('添加到对话')
  expect(add).toHaveBeenCalledWith('引用中的原始正文')
  expect(run).not.toHaveBeenCalled()
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  scope.querySelector('p')!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  const sidebar = document.createElement('div')
  sidebar.textContent = '侧边栏文件内容'
  scope.append(sidebar)
  const range = document.createRange()
  range.selectNodeContents(sidebar)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
  await act(async () => { sidebar.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
  expect(mount.querySelector<HTMLElement>('dialog, .btw-selection-menu')).toBeNull()
})


it('Escape 完整按键不重开，普通按键不触发，键盘选区释放 Shift 后聚焦横条', async () => {
  const p = scope.querySelector('p')!
  p.tabIndex = 0
  p.focus()
  await open()
  for (const type of ['keydown', 'keyup']) {
    await act(async () => { p.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', bubbles: true })) })
  }
  expect(mount.querySelector('.btw-selection-menu')).toBeNull()
  await act(async () => { p.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true })) })
  expect(mount.querySelector('.btw-selection-menu')).toBeNull()
  await act(async () => { p.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true })) })
  expect(document.activeElement?.textContent).toBe('添加到对话')
})

it('没有 Popover API 时降级为普通浮层，仍能打开旁问', async () => {
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: undefined })
  await open()
  expect(mount.querySelector('.btw-selection-menu')?.hasAttribute('popover')).toBe(false)
  await click('旁问')
  expect(mount.querySelector('textarea')).not.toBeNull()
})

it('空问题按 Enter 不报错、不提交', async () => {
  await open(); await click('旁问')
  await act(async () => { mount.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  expect(mount.querySelector('[role="alert"]')).toBeNull()
  expect(run).not.toHaveBeenCalled()
})


it('选区坐标更新保留已打开的 popover，卸载主动关闭', async () => {
  const show = vi.spyOn(HTMLElement.prototype, 'showPopover')
  const hide = vi.spyOn(HTMLElement.prototype, 'hidePopover')
  await open()
  const element = mount.querySelector('.btw-selection-menu')!
  await act(async () => { scope.querySelector('p')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
  expect(mount.querySelector('.btw-selection-menu')).toBe(element)
  expect(show).toHaveBeenCalledTimes(1)
  await act(async () => root.render(null))
  expect(hide).toHaveBeenCalledTimes(1)
})

