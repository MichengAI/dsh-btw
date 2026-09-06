import { describe, expect, it, vi } from 'vitest'
import { SideJobs, type ChildRun, type StartChild } from '../src/server/jobs'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const answer = { stopReason: 'completed', output: [{ type: 'text', text: '答案' }] }
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

describe('一次性旁问生命周期', () => {
  it('正常完成后释放子代理，强制空工具白名单', async () => {
    const dispose = vi.fn(async () => {})
    const start = vi.fn<StartChild>(async () => ({ result: Promise.resolve(answer), dispose }))
    const jobs = new SideJobs(start)
    expect(await jobs.ask('parent', 'request01', '为什么？')).toEqual({ kind: 'success', text: '答案' })
    expect(start.mock.calls[0]?.[0].toolFilter).toEqual({ allow: [] })
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(jobs.size).toBe(0)
  })

  it('关闭等待迟到的启动结果并清理，答案不再返回', async () => {
    const starting = deferred<ChildRun>()
    const start = vi.fn<StartChild>(() => starting.promise)
    const dispose = vi.fn(async () => {})
    const jobs = new SideJobs(start)
    const task = jobs.ask('parent', 'request01', '为什么？')
    const closing = jobs.close('parent', 'request01')
    starting.resolve({ result: Promise.resolve(answer), dispose })
    expect((await task).kind).toBe('error')
    expect(await closing).toEqual({ kind: 'success', text: '' })
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('取消不依赖模型响应；取消对应请求，不影响另一请求', async () => {
    const pending = deferred<typeof answer>()
    const dispose = vi.fn(async () => {})
    const jobs = new SideJobs(async () => ({ result: pending.promise, dispose }))
    const first = jobs.ask('parent', 'request01', 'A')
    const second = jobs.ask('other', 'request02', 'B')
    await tick()
    await jobs.close('parent', 'request01')
    expect((await first).kind).toBe('error')
    expect(jobs.size).toBe(1)
    pending.resolve(answer)
    expect((await second).kind).toBe('success')
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('关闭先于运行到达时不再启动子代理', async () => {
    const start = vi.fn<StartChild>()
    const jobs = new SideJobs(start)
    await jobs.close('parent', 'request01')
    expect((await jobs.ask('parent', 'request01', 'A')).kind).toBe('error')
    expect(start).not.toHaveBeenCalled()
  })

  it('会话隔离，不能关闭另一会话的请求', async () => {
    const pending = deferred<typeof answer>()
    const jobs = new SideJobs(async () => ({ result: pending.promise, dispose: async () => {} }))
    const task = jobs.ask('parent', 'request01', 'A')
    await jobs.close('other', 'request01')
    expect(jobs.size).toBe(1)
    pending.resolve(answer)
    expect((await task).kind).toBe('success')
  })

  it('清理失败可重试，不能显示成功关闭', async () => {
    const dispose = vi.fn().mockRejectedValueOnce(new Error('清理失败')).mockResolvedValue(undefined)
    const jobs = new SideJobs(async () => ({ result: Promise.resolve(answer), dispose }))
    expect((await jobs.ask('parent', 'request01', 'A')).text).toContain('清理失败')
    expect(jobs.size).toBe(1)
    expect((await jobs.close('parent', 'request01')).kind).toBe('success')
    expect(jobs.size).toBe(0)
  })

  it('拒绝重复请求，避免多次启动与重复费用', async () => {
    const pending = deferred<typeof answer>()
    const start = vi.fn<StartChild>(async () => ({ result: pending.promise, dispose: async () => {} }))
    const jobs = new SideJobs(start)
    const task = jobs.ask('parent', 'request01', 'A')
    expect((await jobs.ask('parent', 'request01', 'A')).kind).toBe('error')
    pending.resolve(answer)
    await task
    expect(start).toHaveBeenCalledTimes(1)
  })
})
