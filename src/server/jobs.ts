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
  controller: AbortController
  run?: ChildRun
  cleanup?: Promise<void>
  finished: Promise<SideResult>
  t: BtwTranslate
}

const failure = (error: unknown): SideResult => ({ kind: 'error', text: error instanceof Error ? error.message : String(error) })

/** 管理一次性任务；父会话和请求标识共同构成所有权边界。 */
export class SideJobs {
  private readonly jobs = new Map<string, Job>()
  private readonly retired = new Map<string, number>()
  private disposed = false

  constructor(private readonly start: StartChild, private readonly timeoutMs = 90_000) {}

  get size(): number { return this.jobs.size }

  ask(scope: string, id: string, question: string, signal?: AbortSignal, context?: unknown, locale: BtwLocale = 'zh'): Promise<SideResult> {
    const key = JSON.stringify([scope, id])
    const t = translate(locale)
    this.prune()
    if (this.disposed) return Promise.resolve(failure(t('error.stopped')))
    if (this.jobs.has(key) || this.retired.has(key)) return Promise.resolve(failure(t('error.duplicate')))
    if (this.jobs.size >= 8) return Promise.resolve(failure(t('error.capacity')))
    const job: Job = { controller: new AbortController(), finished: Promise.resolve({ kind: 'success', text: '' }), t }
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
        if (!job.run) {
          this.jobs.delete(key)
          this.retire(key)
        }
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
    await job.finished
    try {
      await this.cleanup(job)
      this.jobs.delete(key)
      return { kind: 'success', text: '' }
    } catch (error) { return failure(error) }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    const outcomes = await Promise.all([...this.jobs.keys()].map(key => {
      const [scope, id] = JSON.parse(key) as [string, string]
      return this.close(scope, id)
    }))
    const errors = outcomes.filter(outcome => outcome.kind === 'error')
    if (errors.length) throw new Error(errors.map(error => error.text).join('\n'))
  }

  private async execute(job: Job, request: ChildRequest): Promise<SideResult> {
    let result: SideResult
    let off = () => {}
    try {
      request.signal.throwIfAborted()
      job.run = await this.start(request)
      const interrupted = new Promise<never>((_, reject) => {
        const abort = () => reject(request.signal.reason)
        request.signal.addEventListener('abort', abort, { once: true })
        off = () => request.signal.removeEventListener('abort', abort)
        if (request.signal.aborted) abort()
      })
      const response = await Promise.race([job.run.result, interrupted])
      request.signal.throwIfAborted()
      const text = response.output.filter(block => block.type === 'text').map(block => block.text ?? '').join('').trim()
      if (response.stopReason !== 'completed') throw new Error(job.t('error.incomplete', { reason: response.stopReason, detail: text ? `\n\n${text}` : '' }))
      if (!text) throw new Error(job.t('error.noText'))
      result = { kind: 'success', text }
    } catch (error) { result = failure(error) }
    finally { off() }
    try { await this.cleanup(job) }
    catch (error) { return failure(job.t('error.cleanup', { detail: error instanceof Error ? error.message : String(error) })) }
    return result
  }

  private async cleanup(job: Job): Promise<void> {
    if (!job.run) return
    if (!job.cleanup) {
      job.cleanup = Promise.resolve().then(() => job.run?.dispose()).then(() => { job.run = undefined })
        .catch(error => { job.cleanup = undefined; throw error })
    }
    await job.cleanup
  }

  private retire(key: string): void {
    this.retired.set(key, Date.now())
    this.prune()
  }
  private prune(): void {
    for (const [key, time] of this.retired) if (Date.now() - time > 300_000 || this.retired.size > 1_000) this.retired.delete(key)
  }
}
