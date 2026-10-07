import React from 'react';
import { type HostMarkdownLabels } from './host-markdown';
/** 旁问不加载远程图片。代码块和行内代码里的写法保持原样。 */
export declare function neutralizeMarkdownImages(source: string, emptyAlt?: string): string;
export declare function AnswerMarkdown({ text, labels, imageLabel }: {
    text: string;
    labels: HostMarkdownLabels;
    imageLabel: string;
}): React.JSX.Element;
