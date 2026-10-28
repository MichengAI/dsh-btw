import React from 'react';
import type { BtwTranslate } from '../locales';
type OpenAskHandler = (text: string) => void;
/**
 * 注册指定会话的旁问弹窗打开回调。
 */
export declare function registerAskHandler(sessionId: string, handler: OpenAskHandler): () => void;
/**
 * 触发指定会话打开旁问弹窗。
 */
export declare function triggerAskModal(sessionId: string, text: string): boolean;
/**
 * 安全向 uiConversation.interactions 注册交互项（避免重复注册已存在的 ID 抛错）。
 */
export declare function safeRegisterInteraction(interactions: {
    definitions?: Map<string, unknown>;
    has?: (id: string) => boolean;
    register?: (item: unknown) => () => void;
} | undefined, item: {
    id: string;
    onInteraction: (request: any) => void;
}): (() => void) | undefined;
export interface NativeBtwAskActionProps {
    sessionId?: string;
    dismiss: () => void;
    readText: () => string | null;
    clearSelection: () => void;
    useSession?: (selector: (session: any) => any) => any;
    t: BtwTranslate;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'conversation.chat.text-interaction': {
            kind: 'keyed';
            scope: 'session';
        };
    }
}
/**
 * 接入官方 conversation.chat.text-interaction 插槽的原生「旁问」按钮。
 * 当用户在正文划选文本时，随官方选区工具栏原生渲染。
 */
export declare function NativeBtwAskAction({ sessionId, dismiss, readText, clearSelection, useSession, t, }: NativeBtwAskActionProps): React.JSX.Element | null;
export {};
