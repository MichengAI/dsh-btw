import type { SideResult } from '../shared'
import { translate, type BtwLocale, type BtwTranslate } from '../locales'

export interface ChildResult {
  stopReason: string
  output: readonly { type: string; text?: string }[]
}
export interface ChildRun {
  result: Promise<ChildResult>
  dispose(): Promise<void>
}
export interface ChildRequest {
  scope: string
  id: string
  question: string
  signal: AbortSignal
  toolFilter: { allow: readonly string[] }
  context?: unknown
  locale: BtwLocale
}
export type StartChild = (request: ChildRequest) => Promise<ChildRun>

interface Job {
  key: string
  controller: AbortController
  starting?: Promise<ChildRun>
  run?: ChildRun
  cleanup?: Promise<void>
  finished: Promise<SideResult>
  t: BtwTranslate
}

interface JobOptions {
  cleanupTimeoutMs?: number
  onError?: (error: Error) => void
  /** 卸载后所有实际资源均释放时调用；用于释放执行保护。 */
  onIdle?: () => void | Promise<void>
}

const failure = (error: unknown): SideResult => ({ kind: 'error', text: error instanceof Error ? error.message : String(error) })

/** 管理一次性任务；父会话和请求标识共同构成所有权边界。 */
export class SideJobs {
  private readonly jobs = new Map<string, Job>()
  private readonly retired = new Map<string, number>()
  private disposed = false
  private idleNotified = false

  constructor(private readonly start: StartChild, private readonly timeoutMs = 90_000, private readonly options: JobOptions = {}) {}

  get size(): number { return this.jobs.size }

  ask(scope: string, id: string, question: string, signal?: AbortSignal, context?: unknown, locale: BtwLocale = 'zh'): Promise<SideResult> {
    const key = JSON.stringify([scope, id])
    const t = translate(locale)
    this.prune()
    if (this.disposed) return Promise.resolve(failure(t('error.stopped')))
    if (this.jobs.has(key) || this.retired.has(key)) return Promise.resolve(failure(t('error.duplicate')))
    if (this.jobs.size >= 8) return Promise.resolve(failure(t('error.capacity')))
    const job: Job = { key, controller: new AbortController(), finished: Promise.resolve({ kind: 'success', text: '' }), t }
    this.jobs.set(key, job)
    const cancel = () => job.controller.abort(new Error(t('error.cancelled')))
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) cancel()
    const timer = setTimeout(() => job.controller.abort(new Error(t('error.timeout'))), this.timeoutMs)
    timer.unref?.()
    job.finished = this.execute(job, { scope, id, question, signal: job.controller.signal, toolFilter: { allow: [] }, context, locale })
      .finally(() => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
        this.release(job)
      })
    return job.finished
  }

  /** 关闭可先于启动到达；短期墓碑阻止网络乱序重新启动请求。 */
  async close(scope: string, id: string): Promise<SideResult> {
    const key = JSON.stringify([scope, id])
    this.retire(key)
    const job = this.jobs.get(key)
    if (!job) return { kind: 'success', text: '' }
    job.controller.abort(new Error(job.t('error.cancelled')))
    try {
      await this.cleanup(job)
      return { kind: 'success', text: '' }
    } catch (error) { return failure(error) }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.all([...this.jobs.values()].map(async job => {
      job.controller.abort(new Error(job.t('error.cancelled')))
      try { await this.cleanup(job) }
      catch (error) { this.report(job, error) }
    }))
    this.notifyIdle()
  }

  private async execute(job: Job, request: ChildRequest): Promise<SideResult> {
    let result: SideResult
    try {
      request.signal.throwIfAborted()
      const starting = this.start(request).then(run => {
        job.run = run
        // 取消可能先于句柄到达；仍接住结果拒绝，实际释放由 cleanup 负责。
        void run.result.catch(() => {})
        return run
      })
      job.starting = starting
      void starting.then(() => {
        job.starting = undefined
        if (request.signal.aborted) this.cleanupLater(job)
      }, error => {
        job.starting = undefined
        if (request.signal.aborted) this.report(job, error)
        this.release(job)
      })
      const run = await this.interruptible(starting, request.signal)
      const response = await this.interruptible(run.result, request.signal)
      request.signal.throwIfAborted()
      const text = response.output.filter(block => block.type === 'text').map(block => block.text ?? '').join('').trim()
      if (response.stopReason !== 'completed') throw new Error(job.t('error.incomplete', { reason: response.stopReason, detail: text ? `\n\n${text}` : '' }))
      if (!text) throw new Error(job.t('error.noText'))
      result = { kind: 'success', text }
    } catch (error) { result = failure(error) }
    if (request.signal.aborted) {
      this.cleanupLater(job)
      return result
    }
    try { await this.cleanup(job) }
    catch (error) { this.report(job, error) }
    return result
  }

  private async cleanup(job: Job): Promise<void> {
    if (job.starting) {
      // 启动失败表示没有句柄；超时则继续保留额度，接管以后到达的句柄。
      await this.bounded(job.starting.then(() => {}, () => {}), job)
    }
    if (!job.run) { this.release(job); return }
    if (!job.cleanup) {
      const run = job.run
      job.cleanup = Promise.resolve().then(() => run.dispose()).then(() => { job.run = undefined; this.release(job) })
        .catch(error => { job.cleanup = undefined; throw error })
    }
    // 等待超时不清空仍在运行的 Promise，避免重试时并发调用 dispose。
    await this.bounded(job.cleanup, job)
  }

  private cleanupLater(job: Job): void {
    void this.cleanup(job).catch(error => this.report(job, error))
  }

  private async interruptible<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    let abort = () => {}
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
    try { return await Promise.race([promise, interrupted]) }
    finally { signal.removeEventListener('abort', abort) }
  }

  private async bounded<T>(promise: Promise<T>, job: Job): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(job.t('error.cleanupTimeout'))), this.options.cleanupTimeoutMs ?? 5_000)
      timer.unref?.()
    })
    try { return await Promise.race([promise, timeout]) }
    finally { clearTimeout(timer) }
  }

  private release(job: Job): void {
    if (job.starting || job.run || this.jobs.get(job.key) !== job) return
    this.jobs.delete(job.key)
    this.retire(job.key)
    this.notifyIdle()
  }

  private report(job: Job, error: unknown): void {
    const issue = new Error(job.t('error.cleanup', { detail: error instanceof Error ? error.message : String(error) }))
    try {
      if (this.options.onError) this.options.onError(issue)
      else console.error(issue)
    } catch (error) { console.error(error) }
  }

  private notifyIdle(): void {
    if (!this.disposed || this.jobs.size || this.idleNotified) return
    this.idleNotified = true
    void Promise.resolve().then(() => this.options.onIdle?.()).catch(error => { console.error(error) })
  }

  private retire(key: string): void {
    this.retired.set(key, Date.now())
    this.prune()
  }
  private prune(): void {
    for (const [key, time] of this.retired) if (Date.now() - time > 300_000 || this.retired.size > 1_000) this.retired.delete(key)
  }
}
