import { expect, it, vi } from 'vitest'
import { addQuoteToComposer, appendQuote } from '../src/client/composer'
import { translate } from '../src/locales'

it('追加引用保留草稿和原文空白，处理换行与重复追加', () => {
  expect(appendQuote('', ' a\nb ')).toBe('>  a\n> b \n\n')
  expect(appendQuote('draft', 'q')).toBe('draft\n\n> q\n\n')
  expect(appendQuote('draft\n', 'q')).toBe('draft\n\n> q\n\n')
  expect(appendQuote('draft\r\n', 'a\r\nb')).toBe('draft\r\n\n> a\n> b\n\n')
  expect(appendQuote(appendQuote('', 'one'), 'two')).toBe('> one\n\n> two\n\n')
})

it('提交阶段不写草稿、不聚焦；可编辑阶段使用最新草稿并在写入后聚焦', () => {
  let draft = 'existing'
  let phase = 'plain'
  const focus = vi.fn()
  const setDraft = vi.fn((text: string) => { draft = text; expect(focus).not.toHaveBeenCalled() })
  const input = { state: { getSnapshot: () => ({ draft, phase }) }, setDraft }
  for (phase of ['adjudicating', 'submitting']) expect(() => addQuoteToComposer(input, 'q', translate(), focus)).toThrow('消息正在提交')
  expect(setDraft).not.toHaveBeenCalled()
  expect(focus).not.toHaveBeenCalled()
  for (phase of ['plain', 'claimed']) {
    focus.mockClear()
    const before = draft
    addQuoteToComposer(input, 'q', translate(), focus)
    expect(draft).toBe(appendQuote(before, 'q'))
    expect(focus).toHaveBeenCalledOnce()
  }
})
