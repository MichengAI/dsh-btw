import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import { zh } from './locales/zh'
import { en } from './locales/en'
import { ja } from './locales/ja'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { de } from './locales/de'
import { ru } from './locales/ru'
import { pt } from './locales/pt'

export const NS = 'michengai.btw'

export { zh, en, ja, es, fr, de, ru, pt }

export type MessageKey = keyof typeof zh
export type BtwTranslate = Translate<MessageKey>
export type BtwLocale = 'zh' | 'en' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt'

export const LOCALE_DICTIONARIES: Record<BtwLocale, Record<MessageKey, string>> = {
  zh,
  en,
  ja,
  es,
  fr,
  de,
  ru,
  pt,
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'michengai.btw': MessageKey }
}

/** 服务端按请求语言生成提示；客户端使用宿主 locale.bind 和 slot 的 t。 */
export function translate(locale: BtwLocale = 'zh'): BtwTranslate {
  const dictionary = LOCALE_DICTIONARIES[locale] ?? LOCALE_DICTIONARIES.en
  return (key, params) => (dictionary[key] ?? LOCALE_DICTIONARIES.en[key] ?? String(key)).replace(/\{(\w+)\}/g, (match, name: string) => String(params?.[name] ?? match))
}

export function normalizeLocale(value: unknown): BtwLocale {
  if (value === undefined || value === null) return 'zh'
  if (typeof value === 'string') {
    const code = value.toLowerCase().split(/[-_]/)[0]
    if (code === 'zh') return 'zh'
    if (code === 'en') return 'en'
    if (code === 'ja') return 'ja'
    if (code === 'es') return 'es'
    if (code === 'fr') return 'fr'
    if (code === 'de') return 'de'
    if (code === 'ru') return 'ru'
    if (code === 'pt') return 'pt'
  }
  return 'en'
}
