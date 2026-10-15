// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BubbleDock, BubbleView } from '../src/client/BubbleView'
import { BubbleStore, type Bubble } from '../src/client/bubbles'
import { translate } from '../src/locales'

let container: HTMLDivElement
let root: Root
const close = vi.fn()
const answer = '正常回答\n\n<script>window.compromised = true</script>\n\n[正常链接](https://example.com) [危险链接](javascript:alert%281%29)\n\n![图片说明](https://example.com/tracker.png)'
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  close.mockClear()
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const render = async () => {
  await act(async () => root.render(React.createElement(BubbleView, {
    item: { id: 'request01', sessionId: 'session', question: '问题', answer, phase: 'done' }, close, t: translate('en'),
  })))
}
const click = async (label: string) => {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(button).not.toBeNull()
  await act(async () => button!.click())
}

it('实际 Markdown 渲染拒绝 HTML、脚本链接和远程图片，并保护新窗口链接', async () => {
  await render()
  expect(container.querySelector('script')).toBeNull()
  expect(container.textContent).not.toContain('window.compromised')
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('图片说明')
  const links = [...container.querySelectorAll('a')]
  expect(links[0]?.href).toBe('https://example.com/')
  expect(links[0]?.target).toBe('_blank')
  expect(links[0]?.rel.split(' ')).toEqual(expect.arrayContaining(['noreferrer', 'noopener']))
  expect(links[1]?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
})

it('正在回答时提供停止按钮，支持中英文无障碍提示且点击触发取消', async () => {
  const item: Bubble = { id: 'request01', sessionId: 'session', question: '问题', answer: '', phase: 'answering' }
  await act(async () => root.render(React.createElement(BubbleView, { item, close, t: translate('en') })))
  await click('Stop answering')
  expect(close).toHaveBeenCalledOnce()
  close.mockClear()
  await act(async () => root.render(React.createElement(BubbleView, { item, close, t: translate('zh') })))
  await click('停止回答')
  expect(close).toHaveBeenCalledOnce()
  close.mockClear()
})

it('复制保留原始 Markdown；折叠、展开和关闭可操作', async () => {
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const toggle = vi.fn()
  await act(async () => root.render(React.createElement(BubbleView, {
    item: { id: 'request01', sessionId: 'session', question: '问题', answer, phase: 'done' },
    close,
    t: translate('en'),
    collapsed: false,
    onToggleCollapse: toggle,
  })))
  await click('Copy answer')
  expect(writeText).toHaveBeenCalledWith(answer)
  expect(container.querySelector('button[title="Copied"]')).not.toBeNull()
  await click('Collapse answer')
  expect(toggle).toHaveBeenCalledOnce()
  await click('Close side question')
  expect(close).toHaveBeenCalledOnce()
})

it('BubbleDock 真实生命周期：新气泡自动展开老气泡折叠、手动操作后新气泡仍夺回焦点、关闭展开项回落最新', async () => {
  const transport = {
    run: vi.fn(async () => ({ kind: 'success' as const, text: '回答' })),
    close: vi.fn(async () => ({ kind: 'success' as const, text: '' })),
  }
  const store = new BubbleStore(transport, translate('en'))
  const sessionId = 'session-dock'

  await act(async () => root.render(React.createElement(BubbleDock, { store, sessionId, t: translate('en') })))
  expect(container.querySelector('.btw-dock')).toBeNull()

  // 1. 发送第 1 个气泡：自动展开
  await act(async () => { await store.ask(sessionId, '问题1') })
  const cards1 = container.querySelectorAll('.btw-bubble')
  expect(cards1).toHaveLength(1)
  expect(cards1[0]?.querySelector('.btw-actions button[aria-expanded="true"]')).not.toBeNull()

  // 2. 发送第 2 个气泡：第 1 个自动收起，第 2 个展开（直接断言 .btw-answer 视图可见性）
  await act(async () => { await store.ask(sessionId, '问题2') })
  const cards2 = container.querySelectorAll('.btw-bubble')
  expect(cards2).toHaveLength(2)
  expect(cards2[0]?.querySelector('.btw-actions button[aria-expanded="false"]')).not.toBeNull()
  expect(cards2[0]?.querySelector('.btw-answer')).toBeNull()
  expect(cards2[1]?.querySelector('.btw-actions button[aria-expanded="true"]')).not.toBeNull()
  expect(cards2[1]?.querySelector('.btw-answer')).not.toBeNull()

  // 3. 用户手动收起最新气泡 (第 2 个)，此时两个都收起，内容均不可见
  const collapseBtn2 = cards2[1]?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
  expect(collapseBtn2).not.toBeNull()
  await act(async () => collapseBtn2!.click())
  expect(container.querySelectorAll('.btw-actions button[aria-expanded="true"]')).toHaveLength(0)
  expect(container.querySelectorAll('.btw-answer')).toHaveLength(0)

  // 4. 发送第 3 个气泡：丢弃手动的收起，第 3 个稳定夺回展开焦点（验证第 1、2 项皆无 .btw-answer，第 3 项有）
  await act(async () => { await store.ask(sessionId, '问题3') })
  const cards3 = container.querySelectorAll('.btw-bubble')
  expect(cards3).toHaveLength(3)
  expect(cards3[0]?.querySelector('.btw-actions button[aria-expanded="false"]')).not.toBeNull()
  expect(cards3[0]?.querySelector('.btw-answer')).toBeNull()
  expect(cards3[1]?.querySelector('.btw-actions button[aria-expanded="false"]')).not.toBeNull()
  expect(cards3[1]?.querySelector('.btw-answer')).toBeNull()
  expect(cards3[2]?.querySelector('.btw-actions button[aria-expanded="true"]')).not.toBeNull()
  expect(cards3[2]?.querySelector('.btw-answer')).not.toBeNull()

  // 5. 用户手动展开第 1 个老气泡
  const expandBtn1 = cards3[0]?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
  await act(async () => expandBtn1!.click())
  expect(cards3[0]?.querySelector('.btw-actions button[aria-expanded="true"]')).not.toBeNull()
  expect(cards3[2]?.querySelector('.btw-actions button[aria-expanded="false"]')).not.toBeNull()

  // 6. 发送第 4 个气泡：丢弃老气泡固定，第 4 个夺回展开焦点
  await act(async () => { await store.ask(sessionId, '问题4') })
  const cards4 = container.querySelectorAll('.btw-bubble')
  expect(cards4).toHaveLength(4)
  expect(cards4[0]?.querySelector('.btw-actions button[aria-expanded="false"]')).not.toBeNull()
  expect(cards4[3]?.querySelector('.btw-actions button[aria-expanded="true"]')).not.toBeNull()

  // 7. 用户在全收起状态下，关掉最新一条，上一条不应意外弹开
  // 先把第 4 条手动收起：
  const collapseBtn4 = cards4[3]?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
  await act(async () => collapseBtn4!.click())
  expect(container.querySelectorAll('.btw-actions button[aria-expanded="true"]')).toHaveLength(0)

  // 关闭第 4 个气泡：由于用户刚才选择的是全部收起，关闭后不应擅自把第 3 个弹开
  const closeBtn4 = cards4[3]?.querySelector<HTMLButtonElement>('button[aria-label="Close side question"]')
  await act(async () => closeBtn4!.click())
  const cardsAfterClose = container.querySelectorAll('.btw-bubble')
  expect(cardsAfterClose).toHaveLength(3)
  expect(container.querySelectorAll('.btw-actions button[aria-expanded="true"]')).toHaveLength(0)
})

it('复制失败显示可恢复错误，重试成功清除提示', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('权限不足')).mockResolvedValueOnce(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await render()
  await click('Copy answer')
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Copy failed')
  await click('Copy answer')
  expect(container.querySelector('[role="alert"]')).toBeNull()
})
