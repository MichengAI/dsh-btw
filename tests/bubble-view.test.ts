// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BubbleView } from '../src/client/BubbleView'
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

it('复制保留原始 Markdown；折叠、展开和关闭可操作', async () => {
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await render()
  await click('Copy answer')
  expect(writeText).toHaveBeenCalledWith(answer)
  expect(container.querySelector('button[title="Copied"]')).not.toBeNull()
  await click('Collapse answer')
  expect(container.querySelector('.btw-answer')).toBeNull()
  expect(container.querySelector('[aria-expanded="false"]')).not.toBeNull()
  await click('Expand answer')
  expect(container.querySelector('.btw-answer')).not.toBeNull()
  await click('Close side question')
  expect(close).toHaveBeenCalledOnce()
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
