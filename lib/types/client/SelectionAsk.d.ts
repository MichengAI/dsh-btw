import React from 'react';
import type { BubbleStore } from './bubbles';
import type { BtwTranslate } from '../locales';
import type { QuoteStore } from './quotes';
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
/** 只接管会话正文选区；非模态 popover 不抢选区，顶层避免滚动裁切。 */
export declare function SelectionAsk({ store, quoteStore, sessionId, t, input, addToConversation, }: {
    store: BubbleStore;
    quoteStore?: QuoteStore;
    sessionId: string;
    t: BtwTranslate;
    input?: DraftInput;
    addToConversation?: (reference: string) => void;
}): React.JSX.Element;
export {};
