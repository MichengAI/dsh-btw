import type {
  ClientSessionContext,
  InputTriggerCandidate,
  InputTriggerPick,
  InputTriggerSource,
  PickOutcome,
  ReferenceCodec,
  ReferenceInsert,
  TokenSpan,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { BtwTranslate } from '../locales'
import { formatQuotesWithDraft, jumpToQuote, type QuotedReference, type QuoteStore } from './quotes'

export const QUOTE_TRIGGER_SOURCE = 'dsh-btw-quote'

export interface SerializedQuotePayload {
  id: string
  role: 'user' | 'assistant'
  turnIndex?: number
  text: string
  comment?: string
}

export function serializeQuoteRef(quote: {
  id: string
  role: 'user' | 'assistant'
  turnIndex?: number
  text: string
  comment?: string
}): string {
  const payload: SerializedQuotePayload = {
    id: quote.id,
    role: quote.role,
    turnIndex: quote.turnIndex,
    text: quote.text,
    comment: quote.comment,
  }
  return JSON.stringify(payload)
}

export function parseQuoteRef(raw: string): SerializedQuotePayload | undefined {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.text === 'string') {
      return parsed as SerializedQuotePayload
    }
  } catch {}
  return undefined
}

export function createQuoteReferenceInsert(
  quote: {
    id: string
    role: 'user' | 'assistant'
    turnIndex?: number
    text: string
    comment?: string
  },
  t: BtwTranslate
): ReferenceInsert {
  // 对齐官方 QuoteNode 展现：以引用文本正文作为输入框展示标签（单行超出省略）
  const preview = quote.text.trim().replace(/\s+/g, ' ')
  const label = preview.length > 36 ? `${preview.slice(0, 36)}…` : preview
  const fakeRef: QuotedReference = {
    id: quote.id,
    sessionId: '',
    text: quote.text,
    role: quote.role,
    turnIndex: quote.turnIndex,
    createdAt: Date.now(),
    comment: quote.comment,
  }

  return {
    source: QUOTE_TRIGGER_SOURCE,
    ref: serializeQuoteRef(quote),
    label,
    appearance: 'file',
    clipboardText: `> ${quote.text.trim()}\n\n`,
  }
}

export function createQuoteTriggerSource({
  quoteStore,
  t,
}: {
  quoteStore: QuoteStore
  t: BtwTranslate
}): InputTriggerSource {
  const codec: ReferenceCodec = {
    clipboardText: (ref: string) => {
      const payload = parseQuoteRef(ref)
      if (!payload) return ref
      const fakeRef: QuotedReference = {
        id: payload.id,
        sessionId: '',
        text: payload.text,
        role: payload.role,
        turnIndex: payload.turnIndex,
        createdAt: Date.now(),
        comment: payload.comment,
      }
      return formatQuotesWithDraft('', [fakeRef], t).trim()
    },
    serialize: async (ref: string) => {
      const payload = parseQuoteRef(ref)
      if (!payload) return ref
      const fakeRef: QuotedReference = {
        id: payload.id,
        sessionId: '',
        text: payload.text,
        role: payload.role,
        turnIndex: payload.turnIndex,
        createdAt: Date.now(),
        comment: payload.comment,
      }
      // 进大模型上下文，采用规范格式化
      return formatQuotesWithDraft('', [fakeRef], t)
    },
  }

  return {
    trigger: '@',
    name: QUOTE_TRIGGER_SOURCE,
    showGroupTitle: false,
    codec,
    candidates: async (session: ClientSessionContext): Promise<readonly InputTriggerCandidate[]> => {
      const quotes = quoteStore.getQuotes(session.sessionId)
      return quotes.map(q => {
        const roleName = q.role === 'user' ? t('quote.role.user') : t('quote.role.assistant')
        const turnStr = q.turnIndex ? t('quote.turn', { turn: q.turnIndex }) : ''
        return {
          name: q.id,
          label: `${t('quote.panelTitle')} · ${roleName}${turnStr}`,
          description: q.text.length > 60 ? `${q.text.slice(0, 60)}…` : q.text,
          icon: 'file',
          value: serializeQuoteRef(q),
        }
      })
    },
    onPick: (pick: InputTriggerPick): PickOutcome => {
      const payload = parseQuoteRef(pick.candidate.value ?? '')
      if (!payload) return undefined
      return {
        insert: createQuoteReferenceInsert(payload, t),
      }
    },
    openReference: (session: ClientSessionContext, reference: { ref: string }): boolean => {
      const payload = parseQuoteRef(reference.ref)
      if (!payload) return false
      const quotes = quoteStore.getQuotes(session.sessionId)
      const target = quotes.find(q => q.id === payload.id) ?? {
        id: payload.id,
        sessionId: session.sessionId,
        text: payload.text,
        role: payload.role,
        turnIndex: payload.turnIndex,
        createdAt: Date.now(),
        anchorId: payload.id,
      }
      return jumpToQuote(target)
    },
  }
}

interface CompatibleInputTarget {
  state: { getSnapshot(): { draft: string; draftRev?: number; phase: string } }
  setDraft(text: string): void
  insertReference?(ref: ReferenceInsert, span: TokenSpan): boolean
}

/**
 * 尝试以原子结构化引用（Mention chip）形式向输入框插入引用。
 * 若宿主不支持 insertReference，返回 false，以便降级走传统草稿追加逻辑。
 */
export function insertQuoteReference(
  input: CompatibleInputTarget,
  quote: {
    id: string
    role: 'user' | 'assistant'
    turnIndex?: number
    text: string
    comment?: string
  },
  t: BtwTranslate
): boolean {
  if (typeof input.insertReference !== 'function') return false

  try {
    const actions = (input as any).actions
    const span: TokenSpan = typeof actions?.captureInsertion === 'function'
      ? actions.captureInsertion()
      : typeof (input as any).captureInsertion === 'function'
        ? (input as any).captureInsertion()
        : {
            start: input.state.getSnapshot().draft.length,
            end: input.state.getSnapshot().draft.length,
            draftRev: input.state.getSnapshot().draftRev ?? 0,
          }
    const refInsert = createQuoteReferenceInsert(quote, t)
    return input.insertReference(refInsert, span)
  } catch {
    return false
  }
}
