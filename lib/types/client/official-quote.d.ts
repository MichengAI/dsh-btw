import React from 'react';
/**
 * 将文本格式化为对齐官方规范的 Markdown blockquote 格式。
 * 每一行均加上 `> ` 前缀。
 */
export declare function formatAsBlockquote(text: string): string;
/**
 * 剥离 Markdown blockquote 前缀（最多 3 个前导空格 + > + 可选空格或制表符）。
 */
export declare function quoteTextOf(text: string): string;
/**
 * 识别消息文本中显式带有 `> ` 标记的连续引用块。
 */
export declare function messageQuoteRanges(text: string): {
    start: number;
    end: number;
}[];
export interface QuoteNodeMatch {
    id: 'quote' | 'text';
    start: number;
    end: number;
    data: {
        text: string;
        display?: string;
    };
}
/**
 * 对齐官方 @deepseek-ai/dsh-message-quotes 的 UserText 切分规则。
 */
export declare const officialQuoteRule: {
    id: string;
    order: number;
    match(text: string, from: number): QuoteNodeMatch | undefined;
};
/**
 * 引用文本渲染组件：优先复用宿主原语 QuotePreview；老版本缺少时降级渲染为 1:1 官方链接样式并支持 HoverCard 预览全文。
 */
export declare function OfficialQuotePreview({ text }: {
    text: string;
}): React.JSX.Element;
/**
 * 安全向 uiConversation.userText 注册规则（避免重复注册已存在的官方规则导致崩溃）。
 */
export declare function safeRegisterUserTextRule(userText: {
    definitions?: Map<string, unknown>;
    has?: (id: string) => boolean;
    register?: (rule: unknown) => () => void;
} | undefined, rule: {
    id: string;
    order: number;
    match: (text: string, from: number) => unknown;
}): (() => void) | undefined;
