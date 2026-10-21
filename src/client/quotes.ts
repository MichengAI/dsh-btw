import type { BtwTranslate } from '../locales'

export interface QuotedReference {
  readonly id: string
  readonly sessionId: string
  readonly text: string
  readonly role: 'user' | 'assistant'
  readonly turnIndex?: number
  readonly createdAt: number
  readonly anchorId?: string
  readonly comment?: string
}

let quoteIdCounter = 0

/** 会话引用状态管理（按会话隔离，支持反应式订阅）。 */
export class QuoteStore {
  private readonly sessionQuotes = new Map<string, QuotedReference[]>()
  private readonly listeners = new Set<() => void>()

  getQuotes(sessionId: string): readonly QuotedReference[] {
    return this.sessionQuotes.get(sessionId) ?? []
  }

  addQuote(sessionId: string, input: {
    text: string
    role?: 'user' | 'assistant'
    turnIndex?: number
    anchorElement?: Element
    comment?: string
  }): QuotedReference {
    const list = this.sessionQuotes.get(sessionId) ?? []
    // 避免完全相同的文本在同一会话中重复堆积
    const existing = list.find(q => q.text === input.text)
    if (existing) return existing

    const id = `quote-${++quoteIdCounter}-${Date.now().toString(36)}`
    let anchorId: string | undefined
    if (input.anchorElement) {
      anchorId = id
      input.anchorElement.setAttribute('data-btw-anchor', id)
    }

    const quote: QuotedReference = {
      id,
      sessionId,
      text: input.text,
      role: input.role ?? 'assistant',
      turnIndex: input.turnIndex,
      createdAt: Date.now(),
      anchorId,
      comment: input.comment,
    }

    this.sessionQuotes.set(sessionId, [...list, quote])
    this.notify()
    return quote
  }

  updateComment(sessionId: string, quoteId: string, comment: string): void {
    const list = this.sessionQuotes.get(sessionId)
    if (!list) return
    const next = list.map(q => q.id === quoteId ? { ...q, comment } : q)
    this.sessionQuotes.set(sessionId, next)
    this.notify()
  }

  removeQuote(sessionId: string, quoteId: string): void {
    const list = this.sessionQuotes.get(sessionId)
    if (!list) return
    const next = list.filter(q => q.id !== quoteId)
    if (next.length === list.length) return
    if (next.length === 0) this.sessionQuotes.delete(sessionId)
    else this.sessionQuotes.set(sessionId, next)
    this.notify()
  }

  clearQuotes(sessionId: string): void {
    if (!this.sessionQuotes.has(sessionId)) return
    this.sessionQuotes.delete(sessionId)
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener() } catch {}
    }
  }
}

/** 序列化引用块并与草稿合并为规范 Markdown，附带大模型意图引导词。 */
export function formatQuotesWithDraft(draft: string, quotes: readonly QuotedReference[], t: BtwTranslate): string {
  if (quotes.length === 0) return draft

  const blocks = quotes.map(q => {
    const roleName = q.role === 'user' ? t('quote.role.user') : t('quote.role.assistant')
    const turnStr = q.turnIndex ? t('quote.turn', { turn: q.turnIndex }) : ''
    const header = t('quote.fromRole', { role: roleName, turn: turnStr })
    const body = q.text.split(/\r\n|\r|\n/).map(line => `> ${line}`).join('\n')
    const commentPart = q.comment?.trim() ? `\n> **${t('quote.panelTitle')}**: ${q.comment.trim()}` : ''
    return `${header}\n${body}${commentPart}`
  })

  const headerNotice = `${t('quote.promptHeading')}\n${t('quote.promptInstruction')}`
  const quotesText = `${headerNotice}\n\n${blocks.join('\n\n')}`
  if (!draft.trim()) return `${quotesText}\n\n`
  return `${quotesText}\n\n${t('quote.userRequestHeading')}\n\n${draft.trim()}`
}

/** 滚动并高亮原文锚点 */
export function jumpToQuote(quote: QuotedReference, scope?: HTMLElement | null): boolean {
  if (!quote.anchorId) return false
  const target = (scope ?? document).querySelector(`[data-btw-anchor="${quote.anchorId}"]`)
  if (!target) return false

  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('btw-anchor-highlight')
  setTimeout(() => {
    target.classList.remove('btw-anchor-highlight')
  }, 1600)
  return true
}
