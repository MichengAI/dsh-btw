import { normalizeLocale, translate, type BtwLocale } from './locales'

export const RUN_COMMAND = 'btw-run'
export const CLOSE_COMMAND = 'btw-close'
export const MAX_QUESTION_LENGTH = 8_000

export interface SideRequest {
  id: string
  question: string
  locale: BtwLocale
}

export interface SideResult {
  kind: 'success' | 'error'
  text: string
}

/** 内部命令使用结构化请求，身份始终由宿主会话提供。 */
export function parseRequest(raw: string): SideRequest {
  if (raw.length > 60_000) throw new Error(translate()('error.requestLength'))
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error(translate()('error.request')) }
  if (typeof value !== 'object' || value === null) throw new Error(translate()('error.request'))
  const request = value as Record<string, unknown>
  const locale = normalizeLocale(request.locale)
  const t = translate(locale)
  if (typeof request.id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(request.id)) throw new Error(t('error.id'))
  if (typeof request.question !== 'string' || !request.question.trim()) throw new Error(t('error.empty'))
  if (request.question.length > MAX_QUESTION_LENGTH) throw new Error(t('error.length'))
  return { id: request.id, question: request.question.trim(), locale }
}
