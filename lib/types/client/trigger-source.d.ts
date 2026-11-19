import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
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
export declare function createQuoteTriggerSource({ quoteStore, t, }: {
    quoteStore: QuoteStore;
    t: BtwTranslate;
}): InputTriggerSource;
