import type { InputTriggerSource, ReferenceInsert, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
import type { BtwTranslate } from '../locales';
import { type QuoteStore } from './quotes';
export declare const QUOTE_TRIGGER_SOURCE = "dsh-btw-quote";
export interface SerializedQuotePayload {
    id: string;
    role: 'user' | 'assistant';
    turnIndex?: number;
    text: string;
    comment?: string;
}
export declare function serializeQuoteRef(quote: {
    id: string;
    role: 'user' | 'assistant';
    turnIndex?: number;
    text: string;
    comment?: string;
}): string;
export declare function parseQuoteRef(raw: string): SerializedQuotePayload | undefined;
export declare function createQuoteReferenceInsert(quote: {
    id: string;
    role: 'user' | 'assistant';
    turnIndex?: number;
    text: string;
    comment?: string;
}, t: BtwTranslate): ReferenceInsert;
export declare function createQuoteTriggerSource({ quoteStore, t, }: {
    quoteStore: QuoteStore;
    t: BtwTranslate;
}): InputTriggerSource;
interface CompatibleInputTarget {
    state: {
        getSnapshot(): {
            draft: string;
            draftRev?: number;
            phase: string;
        };
    };
    setDraft(text: string): void;
    insertReference?(ref: ReferenceInsert, span: TokenSpan): boolean;
}
/**
 * 尝试以原子结构化引用（Mention chip）形式向输入框插入引用。
 * 若宿主不支持 insertReference，返回 false，以便降级走传统草稿追加逻辑。
 */
export declare function insertQuoteReference(input: CompatibleInputTarget, quote: {
    id: string;
    role: 'user' | 'assistant';
    turnIndex?: number;
    text: string;
    comment?: string;
}, t: BtwTranslate): boolean;
export {};
