import React from 'react';
import type { BtwTranslate } from '../locales';
import { type QuoteStore } from './quotes';
interface DraftInput {
    state: {
        getSnapshot(): {
            draft: string;
            phase: string;
        };
    };
    setDraft(text: string): void;
    focus?(): void;
    notify?(level: 'info' | 'error', text: string): void;
}
export declare function QuoteDock({ store, sessionId, t, input, }: {
    store: QuoteStore;
    sessionId: string;
    t: BtwTranslate;
    input: DraftInput;
}): React.JSX.Element | null;
export {};
