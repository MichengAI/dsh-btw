import { MAX_QUESTION_LENGTH, type SideResult } from '../shared'
import { translate, type BtwTranslate } from '../locales'

const MAX_BUBBLES_PER_SESSION = 20

export interface Bubble {
  id: string
  sessionId: string
  question: string
  answer: string
  phase: 'answering' | 'done' | 'error' | 'closing'
  error?: string
  closeFailed?: boolean
}
export interface SideTransport {
  run(session: string, id: string, question: string, signal: AbortSignal): Promise<SideResult>
  close(session: string, id: string): Promise<SideResult>
}

/** 仅内存 UI 状态；关闭请求与答案返回按请求身份分别收敛。 */
export class BubbleStore {
  private snapshot: readonly Bubble[] = []
  private readonly listeners = new Set<() => void>()
  private readonly active = new Map<string, AbortController>()
  private readonly closing = new Map<string, Promise<void>>()
  private readonly admitting = new Set<string>()
  private disposed = false
  constructor(private readonly transport: SideTransport, private readonly t: BtwTranslate = translate()) {}
  getSnapshot = (): readonly Bubble[] => this.snapshot
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  /** 返回已接收请求的标识；满额先等待旧气泡关闭，失败时拒绝且不发送新问题。 */
  async ask(sessionId: string, question: string): Promise<string> {
    if (this.disposed) throw new Error(this.t('error.stopped'))
    if (!question.trim()) throw new Error(this.t('error.empty'))
    if (question.length > MAX_QUESTION_LENGTH) throw new Error(this.t('error.length'))
    if (this.admitting.has(sessionId)) throw new Error(this.t('error.bubbleCapacity'))
    if (this.active.size >= 8) throw new Error(this.t('error.capacity'))
    const sessionBubbles = this.snapshot.filter(item => item.sessionId === sessionId)
    if (sessionBubbles.length >= MAX_BUBBLES_PER_SESSION) {
      const oldest = sessionBubbles.find(item => !this.active.has(item.id) && !this.closing.has(item.id) && !item.closeFailed)
      if (!oldest) throw new Error(this.t('error.bubbleCapacity'))
      this.admitting.add(sessionId)
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        // 先确认关闭再接收；传输挂起时有界返回，后续关闭仍由原 Promise 接管。
        await Promise.race([this.close(oldest.id), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(this.t('error.bubbleCapacity'))), 5_000)
        })])
      } finally {
        clearTimeout(timer)
        this.admitting.delete(sessionId)
      }
    }
    if (this.disposed) throw new Error(this.t('error.stopped'))
    if (this.snapshot.filter(item => item.sessionId === sessionId).length >= MAX_BUBBLES_PER_SESSION) throw new Error(this.t('error.bubbleCapacity'))
    if (this.active.size >= 8) throw new Error(this.t('error.capacity'))
    const id = crypto.randomUUID()
    const controller = new AbortController()
    this.active.set(id, controller)
    this.publish([...this.snapshot, { id, sessionId, question, answer: '', phase: 'answering' }])
    void Promise.resolve().then(() => this.transport.run(sessionId, id, question, controller.signal)).then(result => {
      if (controller.signal.aborted || this.closing.has(id)) return
      this.update(id, { phase: result.kind === 'success' ? 'done' : 'error', answer: result.kind === 'success' ? result.text : '', error: result.kind === 'error' ? result.text : undefined })
    }).catch(error => {
      if (!controller.signal.aborted && !this.closing.has(id)) this.update(id, { phase: 'error', error: String(error) })
    }).finally(() => { this.active.delete(id) })
    return id
  }

  close(id: string): Promise<void> {
    const existing = this.closing.get(id)
    if (existing) return existing
    const item = this.snapshot.find(bubble => bubble.id === id)
    if (!item) return Promise.resolve()
    this.update(id, { phase: 'closing', error: undefined, closeFailed: false })
    this.active.get(id)?.abort()
    const operation = Promise.resolve().then(() => this.transport.close(item.sessionId, id)).then(result => {
      if (result.kind === 'error') throw new Error(result.text)
      this.publish(this.snapshot.filter(bubble => bubble.id !== id))
    }).catch(error => {
      this.update(id, { phase: 'error', closeFailed: true, error: error instanceof Error ? error.message : String(error) })
    }).finally(() => { this.closing.delete(id); this.active.delete(id) })
    this.closing.set(id, operation)
    return operation
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.all(this.snapshot.map(item => this.close(item.id)))
  }
  private update(id: string, patch: Partial<Bubble>): void { this.publish(this.snapshot.map(item => item.id === id ? { ...item, ...patch } : item)) }
  private publish(snapshot: readonly Bubble[]): void { this.snapshot = snapshot; for (const listener of this.listeners) listener() }
}
