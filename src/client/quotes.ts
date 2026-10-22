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

function addAnchorIdToElement(el: Element, id: string): void {
  const current = el.getAttribute('data-btw-anchor')?.split(/\s+/).filter(Boolean) ?? []
  if (!current.includes(id)) {
    el.setAttribute('data-btw-anchor', [...current, id].join(' '))
  }
}

function removeAnchorIdFromElement(el: Element, id: string): void {
  const current = el.getAttribute('data-btw-anchor')?.split(/\s+/).filter(Boolean) ?? []
  const next = current.filter(item => item !== id)
  if (next.length > 0) {
    el.setAttribute('data-btw-anchor', next.join(' '))
  } else {
    el.removeAttribute('data-btw-anchor')
  }
}

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
    t?: BtwTranslate
  }): QuotedReference {
    const list = this.sessionQuotes.get(sessionId) ?? []
    const role = input.role ?? 'assistant'

    // 1. 先判断是否为已有引用：同一文本、同一角色、同一轮次视为既有引用
    const existing = list.find(q => q.text === input.text && q.role === role && q.turnIndex === input.turnIndex)
    if (existing) {
      if (input.anchorElement && existing.anchorId) {
        addAnchorIdToElement(input.anchorElement, existing.anchorId)
      }
      return existing
    }

    // 2. 只有新添加引用时，才校验是否超过合计总长度上限
    const currentTotalLength = list.reduce((sum, q) => sum + q.text.length, 0)
    if (currentTotalLength + input.text.length > MAX_TOTAL_QUOTES_LENGTH) {
      const msg = input.t ? input.t('error.quotesTotalLength') : translate()('error.quotesTotalLength')
      throw new Error(msg)
    }

    const id = `quote-${++quoteIdCounter}-${Date.now().toString(36)}`
    let anchorId: string | undefined
    if (input.anchorElement) {
      anchorId = id
      addAnchorIdToElement(input.anchorElement, id)
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

  removeQuote(sessionId: string, quoteId: string): void {
    const list = this.sessionQuotes.get(sessionId)
    if (!list) return
    const target = list.find(q => q.id === quoteId)
    if (target?.anchorId) {
      try {
        const el = document.querySelector(`[data-btw-anchor~="${target.anchorId}"]`)
        if (el) removeAnchorIdFromElement(el, target.anchorId)
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
          const el = document.querySelector(`[data-btw-anchor~="${q.anchorId}"]`)
          if (el) removeAnchorIdFromElement(el, q.anchorId)
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
  let target = quote.anchorId ? root.querySelector(`[data-btw-anchor~="${quote.anchorId}"]`) : null

  // 降级：如果虚拟滚动列表或重新渲染导致 data-btw-anchor 属性丢失，尝试匹配轮次
  // 严格镜像 selection.ts 的独立计数规则：user 与 assistant 轮次独立统计，忽略无关 kind
  if (!target && quote.turnIndex !== undefined) {
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-chat-flow-kind]'))
    let userTurn = 0
    let assistantTurn = 0
    let currentRole: 'user' | 'assistant' | null = null

    for (const r of rows) {
      const k = r.getAttribute('data-chat-flow-kind')
      const rRole: 'user' | 'assistant' | null = k === 'user' ? 'user' : (k === 'assistant' || k === 'assistant-step') ? 'assistant' : null
      if (!rRole) continue
      if (rRole !== currentRole) {
        currentRole = rRole
        if (rRole === 'user') userTurn++
        else assistantTurn++
      }
      const matchIndex = rRole === 'user' ? userTurn : assistantTurn
      if (rRole === quote.role && matchIndex === quote.turnIndex) {
        target = r
        break
      }
    }
  }

  if (!target) return false

  target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  target.classList.add('btw-anchor-highlight')
  setTimeout(() => {
    target?.classList.remove('btw-anchor-highlight')
  }, 1600)
  return true
}
