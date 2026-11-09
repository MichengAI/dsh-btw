import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import { zh } from './locales/zh';
import { en } from './locales/en';
import { ja } from './locales/ja';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { ru } from './locales/ru';
import { pt } from './locales/pt';
export declare const NS = "michengai.btw";
export { zh, en, ja, es, fr, de, ru, pt };
export type MessageKey = keyof typeof zh;
export type BtwTranslate = Translate<MessageKey>;
export type BtwLocale = 'zh' | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt';
export declare const LOCALE_DICTIONARIES: Record<BtwLocale, Record<MessageKey, string>>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'michengai.btw': MessageKey;
    }
}
/** 服务端按请求语言生成提示；客户端使用宿主 locale.bind 和 slot 的 t。 */
export declare function translate(locale?: BtwLocale): BtwTranslate;
export declare function normalizeLocale(value: unknown): BtwLocale;
