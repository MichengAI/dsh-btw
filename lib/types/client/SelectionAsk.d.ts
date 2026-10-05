import React from 'react';
import type { BubbleStore } from './bubbles';
import type { BtwTranslate } from '../locales';
/** 只接管会话正文选区；非模态 popover 不抢选区，顶层避免滚动裁切。 */
export declare function SelectionAsk({ store, sessionId, t, addToConversation }: {
    store: BubbleStore;
    sessionId: string;
    t: BtwTranslate;
    addToConversation: (reference: string) => void;
}): React.JSX.Element;
