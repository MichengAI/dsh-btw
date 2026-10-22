import { type BtwTranslate } from '../locales';
export interface QuotedReference {
    readonly id: string;
    readonly sessionId: string;
    readonly text: string;
    readonly role: 'user' | 'assistant';
    readonly turnIndex?: number;
    readonly createdAt: number;
    readonly anchorId?: string;
    readonly comment?: string;
}
/** 会话引用状态管理（按会话隔离，支持反应式订阅）。 */
export declare class QuoteStore {
    private readonly sessionQuotes;
    private readonly listeners;
    getQuotes(sessionId: string): readonly QuotedReference[];
    addQuote(sessionId: string, input: {
        text: string;
        role?: 'user' | 'assistant';
        turnIndex?: number;
        anchorElement?: Element;
        comment?: string;
        t?: BtwTranslate;
    }): QuotedReference;
    updateComment(sessionId: string, quoteId: string, comment: string): void;
    removeQuote(sessionId: string, quoteId: string): void;
    clearQuotes(sessionId: string): void;
    subscribe(listener: () => void): () => void;
    private notify;
}
/** 序列化引用块并与草稿合并为规范 Markdown，附带大模型意图引导词。 */
export declare function formatQuotesWithDraft(draft: string, quotes: readonly QuotedReference[], t: BtwTranslate): string;
/** 滚动并高亮原文锚点，DOM 节点丢失时尝试降级寻找轮次容器 */
export declare function jumpToQuote(quote: QuotedReference, scope?: HTMLElement | null): boolean;
