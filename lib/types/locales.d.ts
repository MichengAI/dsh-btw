import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
export declare const NS = "michengai.btw";
export declare const zh: {
    'locale.id': string;
    'error.composerBusy': string;
    'selection.ask': string;
    'selection.add': string;
    'selection.btw': string;
    'selection.reference': string;
    'selection.question': string;
    'selection.explain': string;
    'selection.send': string;
    'selection.cancel': string;
    'selection.context': string;
    'error.reference': string;
    'bubble.label': string;
    'bubble.image': string;
    'action.copy': string;
    'action.copied': string;
    'action.expand': string;
    'action.collapse': string;
    'action.close': string;
    'action.retryClose': string;
    'status.answering': string;
    'status.closing': string;
    'command.hint': string;
    'menu.group': string;
    'command.label': string;
    'command.description': string;
    'error.copy': string;
    'error.attachments': string;
    'error.removeAttachments': string;
    'error.backend': string;
    'error.empty': string;
    'error.length': string;
    'error.capacity': string;
    'error.bubbleCapacity': string;
    'error.close': string;
    'error.requestLength': string;
    'error.request': string;
    'error.id': string;
    'error.provider': string;
    'error.stopped': string;
    'error.duplicate': string;
    'error.cancelled': string;
    'error.timeout': string;
    'error.incomplete': string;
    'error.noText': string;
    'error.cleanup': string;
    'error.cleanupTimeout': string;
};
export type MessageKey = keyof typeof zh;
export type BtwTranslate = Translate<MessageKey>;
export type BtwLocale = 'zh' | 'en';
export declare const en: Record<MessageKey, string>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'michengai.btw': MessageKey;
    }
}
/** 服务端按请求语言生成提示；客户端使用宿主 locale.bind 和 slot 的 t。 */
export declare function translate(locale?: BtwLocale): BtwTranslate;
export declare function normalizeLocale(value: unknown): BtwLocale;
