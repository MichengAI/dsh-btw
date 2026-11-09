import React from 'react';
import type { BubbleStore } from './bubbles';
import type { BtwTranslate } from '../locales';
interface DraftInput {
    state: {
        getSnapshot(): {
            draft: string;
            draftRev?: number;
            phase: string;
            occurrences?: readonly {
                source: string;
                ref: string;
            }[];
        };
    };
    setDraft(text: string): void;
    focus?(): void;
    notify?(level: 'info' | 'error', text: string): void;
    insertReference?(ref: unknown, span: unknown): boolean;
    insertQuote?(text: string): boolean;
}
/** 只接管会话正文选区；非模态 popover 不抢选区，顶层避免滚动裁切。 */
export declare function SelectionAsk(props: {
    store: BubbleStore;
    sessionId: string;
    t: BtwTranslate;
    input?: DraftInput;
}): React.JSX.Element;
export {};
