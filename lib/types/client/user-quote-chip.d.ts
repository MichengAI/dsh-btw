import React from 'react';
export interface ParsedQuoteItem {
    readonly label: string;
    readonly text: string;
    readonly role?: 'assistant' | 'user';
    readonly turnIndex?: number;
}
export interface QuoteNodeData {
    readonly label: string;
    readonly count: number;
    readonly raw: string;
    readonly items: readonly ParsedQuoteItem[];
    readonly role?: 'assistant' | 'user';
    readonly turnIndex?: number;
}
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
    interface UserTextDataMap {
        'dsh-btw-quote': QuoteNodeData;
    }
}
export declare function parseQuotePromptBlock(text: string, from?: number): {
    start: number;
    end: number;
    data: QuoteNodeData;
} | undefined;
export declare const quoteUserTextRule: {
    id: "dsh-btw-quote";
    order: number;
    match(text: string, from: number): {
        id: "dsh-btw-quote";
        start: number;
        end: number;
        data: QuoteNodeData;
    } | undefined;
};
export declare function QuoteUserTextNode({ node, }: {
    node: {
        readonly id: 'dsh-btw-quote';
        readonly data: QuoteNodeData;
    };
}): React.JSX.Element;
