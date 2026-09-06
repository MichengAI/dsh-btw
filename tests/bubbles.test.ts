import { expect, it, vi } from 'vitest'
import { BubbleStore } from '../src/client/bubbles'

it('关闭先于回答，迟到结果不能重新打开气泡', async () => {
  let answer!: (value: { kind: 'success'; text: string }) => void
  const store = new BubbleStore({
    run: () => new Promise(resolve => { answer = resolve }),
    close: async () => ({ kind: 'success', text: '' }),
  })
  const id = store.ask('session', '问题')
  await store.close(id)
  answer({ kind: 'success', text: '迟到答案' })
  await new Promise(resolve => setImmediate(resolve))
  expect(store.getSnapshot()).toEqual([])
})

it('关闭失败保留气泡并可重试', async () => {
  const close = vi.fn().mockResolvedValueOnce({ kind: 'error', text: '连接已断开' }).mockResolvedValue({ kind: 'success', text: '' })
  const store = new BubbleStore({ run: () => new Promise(() => {}), close })
  const id = store.ask('session', '问题')
  await store.close(id)
  expect(store.getSnapshot()[0]?.error).toContain('连接已断开')
  await store.close(id)
  expect(store.getSnapshot()).toEqual([])
})

it('两个请求独立更新，不会覆盖先完成的回答', async () => {
  const completions: Array<(value: { kind: 'success'; text: string }) => void> = []
  const store = new BubbleStore({
    run: () => new Promise(resolve => completions.push(resolve)),
    close: async () => ({ kind: 'success', text: '' }),
  })
  store.ask('session', 'A')
  store.ask('session', 'B')
  await Promise.resolve()
  completions[1]?.({ kind: 'success', text: 'B 的回答' })
  completions[0]?.({ kind: 'success', text: 'A 的回答' })
  await new Promise(resolve => setImmediate(resolve))
  expect(store.getSnapshot().map(item => item.answer)).toEqual(['A 的回答', 'B 的回答'])
})

it('同步传输异常显示错误并释放请求额度', async () => {
  const store = new BubbleStore({
    run: () => { throw new Error('连接未就绪') },
    close: async () => ({ kind: 'success', text: '' }),
  })
  for (let index = 0; index < 9; index++) {
    expect(() => store.ask('session', `问题 ${index}`)).not.toThrow()
    await new Promise(resolve => setImmediate(resolve))
  }
  expect(store.getSnapshot().every(item => item.phase === 'error' && item.error?.includes('连接未就绪'))).toBe(true)
})

it('只裁剪当前会话的历史气泡，不淘汰其他会话的答案', async () => {
  const store = new BubbleStore({
    run: async () => ({ kind: 'success', text: '回答' }),
    close: async () => ({ kind: 'success', text: '' }),
  })
  store.ask('A', '保留的回答')
  await new Promise(resolve => setImmediate(resolve))
  for (let index = 0; index < 25; index++) {
    store.ask('B', `问题 ${index}`)
    await new Promise(resolve => setImmediate(resolve))
  }
  expect(store.getSnapshot().filter(item => item.sessionId === 'A')).toHaveLength(1)
  expect(store.getSnapshot().filter(item => item.sessionId === 'B')).toHaveLength(20)
})

it('淘汰气泡先确认关闭，清理失败保留答案和重试入口', async () => {
  const close = vi.fn().mockResolvedValue({ kind: 'error', text: '清理仍在等待' })
  const store = new BubbleStore({ run: async () => ({ kind: 'success', text: '需要保留的答案' }), close })
  const first = store.ask('A', '第一个问题')
  await new Promise(resolve => setImmediate(resolve))
  for (let index = 0; index < 20; index++) {
    store.ask('A', `后续问题 ${index}`)
    await new Promise(resolve => setImmediate(resolve))
  }
  expect(close).toHaveBeenCalledWith('A', first)
  expect(store.getSnapshot().find(item => item.id === first)).toMatchObject({ answer: '需要保留的答案', closeFailed: true })
  close.mockResolvedValue({ kind: 'success', text: '' })
  await store.close(first)
  expect(store.getSnapshot().find(item => item.id === first)).toBeUndefined()
})
