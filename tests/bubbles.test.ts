import { afterEach, expect, it, vi } from 'vitest'
import { BubbleStore } from '../src/client/bubbles'
import { translate } from '../src/locales'

const tick = () => new Promise<void>(resolve => setImmediate(resolve))
afterEach(() => { vi.useRealTimers() })

it('满额关闭挂起时五秒返回，迟到释放不会自动提交已拒绝的问题', async () => {
  const run = vi.fn().mockResolvedValue({ kind: 'success', text: '回答' })
  let finishClose!: (value: { kind: 'success'; text: string }) => void
  const pending = new Promise<{ kind: 'success'; text: string }>(resolve => { finishClose = resolve })
  const store = new BubbleStore({ run, close: () => pending })
  for (let index = 0; index < 20; index++) { await store.ask('A', '问题'); await tick() }
  vi.useFakeTimers()
  const rejected = expect(store.ask('A', '等待超时的问题')).rejects.toThrow('上限')
  await vi.advanceTimersByTimeAsync(5_000)
  await rejected
  expect(store.getSnapshot()).toHaveLength(20)
  expect(run).toHaveBeenCalledTimes(20)
  finishClose({ kind: 'success', text: '' })
  await vi.advanceTimersByTimeAsync(0)
  expect(store.getSnapshot()).toHaveLength(19)
  expect(run).toHaveBeenCalledTimes(20)
  await store.ask('A', '用户重新提交')
  await vi.advanceTimersByTimeAsync(0)
  expect(run).toHaveBeenCalledTimes(21)
})

it('等待腾出气泡空间时卸载，不启动等待中的问题', async () => {
  const run = vi.fn().mockResolvedValue({ kind: 'success', text: '回答' })
  let finishClose!: (value: { kind: 'success'; text: string }) => void
  const pending = new Promise<{ kind: 'success'; text: string }>(resolve => { finishClose = resolve })
  const store = new BubbleStore({ run, close: () => pending })
  for (let index = 0; index < 20; index++) { await store.ask('A', '问题'); await tick() }
  const rejected = expect(store.ask('A', '等待腾出空间')).rejects.toThrow('已停止')
  const unload = store.dispose()
  finishClose({ kind: 'success', text: '' })
  await unload
  await rejected
  expect(run).toHaveBeenCalledTimes(20)
  expect(store.getSnapshot()).toEqual([])
})

it('等待旧气泡关闭后重新检查全局八路额度', async () => {
  const run = vi.fn().mockResolvedValue({ kind: 'success', text: '回答' })
  let finishClose!: (value: { kind: 'success'; text: string }) => void
  const pending = new Promise<{ kind: 'success'; text: string }>(resolve => { finishClose = resolve })
  const store = new BubbleStore({ run, close: () => pending })
  for (let index = 0; index < 20; index++) { await store.ask('A', '问题'); await tick() }
  const rejected = expect(store.ask('A', '等待腾出空间')).rejects.toThrow('较多')
  run.mockImplementation(() => new Promise(() => {}))
  for (let index = 0; index < 8; index++) await store.ask('B', '等待回答')
  finishClose({ kind: 'success', text: '' })
  await rejected
  expect(run).toHaveBeenCalledTimes(28)
  expect(store.getSnapshot().filter(item => item.sessionId === 'A')).toHaveLength(19)
})

it.each(['zh', 'en'] as const)('持续关闭失败时总量有界，保留答案且只限制当前会话（%s）', async locale => {
  const run = vi.fn().mockResolvedValue({ kind: 'success', text: '需要保留的答案' })
  const close = vi.fn().mockResolvedValue({ kind: 'error', text: '清理失败' })
  const store = new BubbleStore({ run, close }, translate(locale))
  for (let index = 0; index < 20; index++) {
    await store.ask('A', `问题 ${index}`)
    await tick()
  }
  const first = store.getSnapshot()[0]!
  const message = locale === 'zh'
    ? '当前会话的旁问气泡已达上限，请先关闭旧气泡；关闭失败的气泡可重试。'
    : 'This session has reached its bubble limit. Close older bubbles first; retry any failed closures.'
  for (let index = 0; index < 100; index++) await expect(store.ask('A', '超额问题')).rejects.toThrow(message)
  await tick()
  expect(store.getSnapshot()).toHaveLength(20)
  expect(store.getSnapshot().every(item => item.answer === '需要保留的答案')).toBe(true)
  expect(store.getSnapshot()[0]).toMatchObject({ id: first.id, closeFailed: true })
  expect(run).toHaveBeenCalledTimes(20)
  await store.ask('B', '另一个会话')
  await tick()
  expect(store.getSnapshot().filter(item => item.sessionId === 'B')).toHaveLength(1)
  close.mockResolvedValue({ kind: 'success', text: '' })
  await store.close(first.id)
  await expect(store.ask('A', '清理后继续提问')).resolves.toEqual(expect.any(String))
  await tick()
  expect(run).toHaveBeenCalledTimes(22)
  expect(store.getSnapshot().some(item => item.id === first.id)).toBe(false)
})

it('传输断开时反复提问不会持续增加错误气泡', async () => {
  const run = vi.fn().mockRejectedValue(new Error('连接断开'))
  const close = vi.fn().mockRejectedValue(new Error('连接断开'))
  const store = new BubbleStore({ run, close })
  for (let index = 0; index < 20; index++) { await store.ask('A', '问题'); await tick() }
  for (let index = 0; index < 100; index++) await expect(store.ask('A', '问题')).rejects.toThrow('上限')
  await tick()
  expect(store.getSnapshot()).toHaveLength(20)
  expect(run).toHaveBeenCalledTimes(20)
})

it('总量包括关闭中与回答中气泡，迟到清理成功后恢复容量', async () => {
  const run = vi.fn().mockResolvedValue({ kind: 'success', text: '回答' })
  let finishClose!: (value: { kind: 'success'; text: string }) => void
  const pendingClose = new Promise<{ kind: 'success'; text: string }>(resolve => { finishClose = resolve })
  const store = new BubbleStore({ run, close: () => pendingClose })
  for (let index = 0; index < 19; index++) { await store.ask('A', '问题'); await tick() }
  run.mockImplementation(() => new Promise(() => {}))
  await store.ask('A', '等待回答')
  const admission = store.ask('A', '清理后才能启动的问题')
  await tick()
  expect(store.getSnapshot().filter(item => item.phase === 'closing')).toHaveLength(1)
  expect(store.getSnapshot().filter(item => item.phase === 'answering')).toHaveLength(1)
  await expect(store.ask('A', '超额问题')).rejects.toThrow('上限')
  expect(store.getSnapshot()).toHaveLength(20)
  expect(run).toHaveBeenCalledTimes(20)
  finishClose({ kind: 'success', text: '' })
  await admission
  await tick()
  expect(store.getSnapshot()).toHaveLength(20)
  expect(run).toHaveBeenCalledTimes(21)
  await tick()
})

it('关闭先于回答，迟到结果不能重新打开气泡', async () => {
  let answer!: (value: { kind: 'success'; text: string }) => void
  const store = new BubbleStore({
    run: () => new Promise(resolve => { answer = resolve }),
    close: async () => ({ kind: 'success', text: '' }),
  })
  const id = await store.ask('session', '问题')
  await store.close(id)
  answer({ kind: 'success', text: '迟到答案' })
  await new Promise(resolve => setImmediate(resolve))
  expect(store.getSnapshot()).toEqual([])
})

it('关闭失败保留气泡并可重试', async () => {
  const close = vi.fn().mockResolvedValueOnce({ kind: 'error', text: '连接已断开' }).mockResolvedValue({ kind: 'success', text: '' })
  const store = new BubbleStore({ run: () => new Promise(() => {}), close })
  const id = await store.ask('session', '问题')
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
  await store.ask('session', 'A')
  await store.ask('session', 'B')
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
    await expect(store.ask('session', `问题 ${index}`)).resolves.toEqual(expect.any(String))
    await new Promise(resolve => setImmediate(resolve))
  }
  expect(store.getSnapshot().every(item => item.phase === 'error' && item.error?.includes('连接未就绪'))).toBe(true)
})

it('只裁剪当前会话的历史气泡，不淘汰其他会话的答案', async () => {
  const store = new BubbleStore({
    run: async () => ({ kind: 'success', text: '回答' }),
    close: async () => ({ kind: 'success', text: '' }),
  })
  await store.ask('A', '保留的回答')
  await new Promise(resolve => setImmediate(resolve))
  for (let index = 0; index < 25; index++) {
    await store.ask('B', `问题 ${index}`)
    expect(store.getSnapshot().filter(item => item.sessionId === 'B').length).toBeLessThanOrEqual(20)
    await new Promise(resolve => setImmediate(resolve))
  }
  expect(store.getSnapshot().filter(item => item.sessionId === 'A')).toHaveLength(1)
  expect(store.getSnapshot().filter(item => item.sessionId === 'B')).toHaveLength(20)
})

it('淘汰气泡先确认关闭，清理失败保留答案和重试入口', async () => {
  const close = vi.fn().mockResolvedValue({ kind: 'error', text: '清理仍在等待' })
  const store = new BubbleStore({ run: async () => ({ kind: 'success', text: '需要保留的答案' }), close })
  const first = await store.ask('A', '第一个问题')
  await new Promise(resolve => setImmediate(resolve))
  for (let index = 0; index < 19; index++) {
    await store.ask('A', `后续问题 ${index}`)
    await new Promise(resolve => setImmediate(resolve))
  }
  await expect(store.ask('A', '超额问题')).rejects.toThrow('上限')
  expect(close).toHaveBeenCalledWith('A', first)
  expect(store.getSnapshot().find(item => item.id === first)).toMatchObject({ answer: '需要保留的答案', closeFailed: true })
  close.mockResolvedValue({ kind: 'success', text: '' })
  await store.close(first)
  expect(store.getSnapshot().find(item => item.id === first)).toBeUndefined()
})
