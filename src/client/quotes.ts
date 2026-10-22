import { MAX_TOTAL_QUOTES_LENGTH } from '../limits'
import { translate, type BtwTranslate } from '../locales'

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
    // 校验合计总长度，防止合并草稿无上限膨胀
    const currentTotalLength = list.reduce((sum, q) => sum + q.text.length, 0)
    if (currentTotalLength + input.text.length > MAX_TOTAL_QUOTES_LENGTH) {
      throw new Error(translate()('error.quotesTotalLength'))
    }

    // 区分角色和轮次出处，避免同文本不同出处被误丢弃
    const role = input.role ?? 'assistant'
    const existing = list.find(q => q.text === input.text && q.role === role && q.turnIndex === input.turnIndex)
    if (existing) {
      if (input.anchorElement && existing.anchorId) {
        input.anchorElement.setAttribute('data-btw-anchor', existing.anchorId)
      }
      return existing
    }

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
      role,
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
    const target = list.find(q => q.id === quoteId)
    if (target?.anchorId) {
      try {
        const el = document.querySelector(`[data-btw-anchor="${target.anchorId}"]`)
        el?.removeAttribute('data-btw-anchor')
      } catch {}
    }
    const next = list.filter(q => q.id !== quoteId)
    if (next.length === list.length) return
    if (next.length === 0) this.sessionQuotes.delete(sessionId)
    else this.sessionQuotes.set(sessionId, next)
    this.notify()
  }

  clearQuotes(sessionId: string): void {
    const list = this.sessionQuotes.get(sessionId)
    if (!list) return
    for (const q of list) {
      if (q.anchorId) {
        try {
          const el = document.querySelector(`[data-btw-anchor="${q.anchorId}"]`)
          el?.removeAttribute('data-btw-anchor')
        } catch {}
      }
    }
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
    const commentPart = q.comment?.trim() ? `\n> **${t('quote.commentLabel')}**: ${q.comment.trim()}` : ''
    return `${header}\n${body}${commentPart}`
  })

  const headerNotice = `${t('quote.promptHeading')}\n${t('quote.promptInstruction')}`
  const quotesText = `${headerNotice}\n\n${blocks.join('\n\n')}`
  if (!draft.trim()) return `${quotesText}\n\n`
  return `${quotesText}\n\n${t('quote.userRequestHeading')}\n\n${draft.trim()}`
}

/** 滚动并高亮原文锚点，DOM 节点丢失时尝试降级寻找轮次容器 */
export function jumpToQuote(quote: QuotedReference, scope?: HTMLElement | null): boolean {
  const root = scope ?? document
  let target = quote.anchorId ? root.querySelector(`[data-btw-anchor="${quote.anchorId}"]`) : null

  // 降级：如果虚拟滚动列表或重新渲染导致 data-btw-anchor 属性丢失，尝试匹配轮次
  if (!target && quote.turnIndex !== undefined) {
    const rows = root.querySelectorAll<HTMLElement>('[data-chat-flow-kind]')
    let currentTurn = 0
    let lastRole: string | undefined
    for (const row of rows) {
      const kind = row.getAttribute('data-chat-flow-kind')
      const role = kind === 'user' ? 'user' : 'assistant'
      if (role !== lastRole) {
        lastRole = role
        if (role === 'user') currentTurn++
      }
      if (role === quote.role && currentTurn === quote.turnIndex) {
        target = row
        break
      }
    }
  }

  if (!target) return false

  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('btw-anchor-highlight')
  setTimeout(() => {
    target?.classList.remove('btw-anchor-highlight')
  }, 1600)
  return true
}
