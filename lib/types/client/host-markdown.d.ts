import type { ComponentType } from 'react';
export interface HostMarkdownLabels {
    code: {
        copyLabel: string;
        copiedLabel: string;
    };
    footnotes: string;
}
export type HostMarkdownText = ComponentType<{
    text: string;
    streaming?: boolean;
    labels: HostMarkdownLabels;
    variant?: 'body' | 'compact';
}>;
/** 宿主基座模块。旧宿主没有它时返回 null，调用方改用自带 Markdown。 */
export declare function loadHostMarkdownText(): HostMarkdownText | null;
