// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { neutralizeMarkdownImages } from '../src/client/answer-markdown'
import { translate } from '../src/locales'

const harness = vi.hoisted(() => {
  const seen: string[] = []
  const labels: Array<{ code: { copyLabel: string; copiedLabel: string } }> = []
  const state = { mode: 'host' as 'host' | 'throw' | 'missing' }
  return { seen, labels, state }
})

function renderMath(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g
  let last = 0
  let key = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(text.slice(last, index))
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    const display = match[1] !== undefined || match[2] !== undefined
    nodes.push(React.createElement('span', { key, className: display ? 'katex-display' : 'katex' }, tex))
    key += 1
    last = index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

vi.mock('../src/client/host-markdown', () => ({
  loadHostMarkdownText: () => {
    if (harness.state.mode === 'missing') return null
    if (harness.state.mode === 'throw') return function ThrowMarkdown() { throw new Error('host markdown failed') }
    return function HostMarkdown({ text, labels }: { text: string; labels: { code: { copyLabel: string; copiedLabel: string } } }) {
      harness.seen.push(text)
      harness.labels.push(labels)
      return React.createElement('div', { 'data-host-markdown': 'true' }, renderMath(text))
    }
  },
}))

import { BubbleView } from '../src/client/BubbleView'

let container: HTMLDivElement
let root: Root
const issue = '$N=8192$ 时这一步就要扫 8192 组向量。累加起来，生成整段长度为 $N$ 的序列总代价是 $O(N^2)$，这就是长上下文推理慢的根本原因。'

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  harness.seen.length = 0
  harness.labels.length = 0
  harness.state.mode = 'host'
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const render = async (answer: string) => {
  await act(async () => root.render(React.createElement(BubbleView, {
    item: { id: 'request01', sessionId: 'session', question: '问题', answer, phase: 'done' },
    close: () => {},
    t: translate('zh'),
  })))
}

it('把公式原文交给宿主渲染，气泡里不再留下美元分隔符', async () => {
  await render(`${issue}\n\n\\(N\\) 与 $$O(N^2)$$ 和 \\[N=8192\\]`)
  expect(harness.seen[0]).toContain('$N=8192$')
  expect(harness.seen[0]).toContain('$O(N^2)$')
  expect(harness.seen[0]).toContain('\\(N\\)')
  expect(harness.seen[0]).toContain('$$O(N^2)$$')
  expect(harness.labels[0]?.code).toEqual({ copyLabel: '复制代码', copiedLabel: '已复制代码' })
  expect(container.querySelector('[data-host-markdown]')).not.toBeNull()
  expect(container.textContent).not.toContain('$N=8192$')
  expect(container.textContent).not.toContain('$O(N^2)$')
  expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(3)
  expect([...container.querySelectorAll('.katex, .katex-display')].map(node => node.textContent)).toEqual(expect.arrayContaining(['N=8192', 'N', 'O(N^2)', 'N=8192']))
})

it('交给宿主前去掉远程图片地址，但保留公式和代码块', async () => {
  await render('看 ![图片说明](https://example.com/tracker.png) 与 $N=8192$\n\n```\n![保留](https://example.com/in-code.png)\n```')
  expect(harness.seen[0]).toContain('图片说明')
  expect(harness.seen[0]).toContain('$N=8192$')
  expect(harness.seen[0]).not.toContain('tracker.png')
  expect(harness.seen[0]).toContain('https://example.com/in-code.png')
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('图片说明')
  expect(container.querySelector('.katex')?.textContent).toBe('N=8192')
})

it('宿主渲染器抛错时回退到文本，不把旁问气泡弄空白', async () => {
  harness.state.mode = 'throw'
  await render(`说明 ${issue}`)
  expect(container.textContent).toContain('说明')
  expect(container.textContent).toContain('$N=8192$')
  expect(container.querySelector('[data-host-markdown]')).toBeNull()
  expect(container.querySelector('script')).toBeNull()
})

it('没有宿主渲染器时保留原文，不加载远程图片', async () => {
  harness.state.mode = 'missing'
  await render('![图片说明](https://example.com/tracker.png)\n\n$N=8192$')
  expect(harness.seen).toEqual([])
  expect(container.querySelector('img')).toBeNull()
  expect(container.textContent).toContain('图片说明')
  expect(container.textContent).toContain('$N=8192$')
})

it('图片中和跳过代码，空替代文字使用占位', () => {
  expect(neutralizeMarkdownImages('`![a](https://example.com/a.png)` ![b](https://example.com/b.png)', '图片')).toBe('`![a](https://example.com/a.png)` b')
  expect(neutralizeMarkdownImages('`` `![a](https://example.com/a.png)` `` ![b](https://example.com/b.png)', '图片')).toBe('`` `![a](https://example.com/a.png)` `` b')
  expect(neutralizeMarkdownImages('![](https://example.com/c.png)', '图片')).toBe('图片')
})

it('客户端构建把宿主 Markdown 留在基座 require', () => {
  const source = readFileSync('src/client/host-markdown.ts', 'utf8')
  const build = readFileSync('scripts/build.mjs', 'utf8')
  expect(source).toContain("require('@deepseek-ai/dsh-client-ui-primitives')")
  expect(build).toContain("'@deepseek-ai/dsh-client-ui-primitives'")
})
