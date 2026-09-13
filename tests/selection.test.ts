// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { captureSelection } from '../src/client/selection'
import { parseRequest } from '../src/shared'

afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })

function fixture() {
  document.body.innerHTML = '<div data-conversation-scroll><div data-chat-flow-kind="assistant-step"><p>选中的正文</p><pre><code>const answer = 42</code></pre></div><div data-chat-flow-kind="user"><p>另一条消息</p></div><textarea>草稿</textarea></div>'
  const scope = document.body.firstElementChild as HTMLElement
  const p = scope.querySelector('p')!
  const range = document.createRange()
  range.selectNodeContents(p)
  window.getSelection()!.addRange(range)
  return { scope, p, range }
}

it('固定单条正文选区，后续流式改写不改变已捕获的引用', () => {
  const { scope, p } = fixture()
  const captured = captureSelection(scope, p)
  p.textContent = '后续输出'
  expect(captured).toBe('选中的正文')
})

it('支持代码块，拒绝跨消息、其他会话和工具输出', () => {
  const { scope, p, range } = fixture()
  const code = scope.querySelector('code')!
  range.selectNodeContents(code)
  expect(captureSelection(scope, code)).toBe('const answer = 42')
  range.setStart(p.firstChild!, 0)
  range.setEnd(scope.querySelectorAll('p')[1]!.firstChild!, 2)
  expect(captureSelection(scope, p)).toBeUndefined()
  range.selectNodeContents(p)
  expect(captureSelection(document.createElement('div'), p)).toBeUndefined()
  p.parentElement!.dataset.chatFlowKind = 'tool'
  expect(captureSelection(scope, p)).toBeUndefined()
})

it('右键选区外或可编辑内容时保留原有菜单', () => {
  const { scope, p } = fixture()
  expect(captureSelection(scope, scope.querySelector('textarea')!)).toBeUndefined()
  p.setAttribute('contenteditable', 'true')
  expect(captureSelection(scope, p)).toBeUndefined()
})

it('服务端保留引用原文，拒绝空引用、非法类型和超长引用', () => {
  const request = { id: 'request01', question: '为什么？', reference: '  const x = 1\n', locale: 'zh' }
  expect(parseRequest(JSON.stringify(request))).toMatchObject(request)
  for (const reference of ['', '  ', 42, 'x'.repeat(8001)]) {
    expect(() => parseRequest(JSON.stringify({ ...request, reference }))).toThrow()
  }
})
