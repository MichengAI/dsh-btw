import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'michengai.btw'
export const zh = {
  'locale.id': 'zh',
  'bubble.label': '旁问回答',
  'bubble.image': '图片',
  'action.copy': '复制回答',
  'action.copied': '已复制',
  'action.expand': '展开回答',
  'action.collapse': '折叠回答',
  'action.close': '关闭旁问',
  'action.retryClose': '重试关闭',
  'status.answering': '正在回答…',
  'status.closing': '正在关闭…',
  'command.hint': '旁问内容',
  'menu.group': '旁问',
  'command.description': '根据当前上下文回答旁问',
  'error.copy': '复制失败，请选择回答文字复制。',
  'error.images': '旁问只接受文字，图片仍保留在输入框中。',
  'error.removeImages': '旁问只接受文字，请先移除图片。',
  'error.backend': 'BTW 后端尚未启用，请检查插件配置。',
  'error.empty': '请输入旁问内容。',
  'error.length': '旁问最多支持 8000 个字符。',
  'error.capacity': '正在处理的旁问较多，请稍后重试。',
  'error.close': '关闭失败，可重试。{detail}',
  'error.requestLength': '旁问内容过长。',
  'error.request': '旁问请求无效。',
  'error.id': '旁问标识无效。',
  'error.provider': '当前 fork provider 不支持继承上下文并禁用工具，旁问未启动。',
  'error.stopped': '旁问插件已停止。',
  'error.duplicate': '该旁问已提交或已关闭。',
  'error.cancelled': '旁问已取消。',
  'error.timeout': '旁问超时，已取消。',
  'error.incomplete': '旁问未完成（{reason}）。{detail}',
  'error.noText': '模型未返回文字回答。',
  'error.cleanup': '资源清理失败，请再次关闭重试。{detail}',
  'error.cleanupTimeout': '资源释放仍未完成，请稍后重试关闭。',
}
export type MessageKey = keyof typeof zh
export type BtwTranslate = Translate<MessageKey>
export type BtwLocale = 'zh' | 'en'
export const en: Record<MessageKey, string> = {
  'locale.id': 'en',
  'bubble.label': 'Side question answer',
  'bubble.image': 'Image',
  'action.copy': 'Copy answer',
  'action.copied': 'Copied',
  'action.expand': 'Expand answer',
  'action.collapse': 'Collapse answer',
  'action.close': 'Close side question',
  'action.retryClose': 'Retry closing',
  'status.answering': 'Answering…',
  'status.closing': 'Closing…',
  'command.hint': 'Side question',
  'menu.group': 'Side Questions',
  'command.description': 'Ask a side question using the current context',
  'error.copy': 'Copy failed. Select the answer text to copy it.',
  'error.images': 'Side questions accept text only. Your images remain in the input.',
  'error.removeImages': 'Side questions accept text only. Remove the images first.',
  'error.backend': 'The BTW backend is unavailable. Check the plugin configuration.',
  'error.empty': 'Enter a side question.',
  'error.length': 'Side questions are limited to 8,000 characters.',
  'error.capacity': 'Too many side questions are running. Try again shortly.',
  'error.close': 'Could not close. Try again. {detail}',
  'error.requestLength': 'The side question request is too long.',
  'error.request': 'Invalid side question request.',
  'error.id': 'Invalid side question ID.',
  'error.provider': 'The fork provider cannot inherit context with tools disabled. The side question was not started.',
  'error.stopped': 'The side question plugin has stopped.',
  'error.duplicate': 'This side question was already submitted or closed.',
  'error.cancelled': 'Side question cancelled.',
  'error.timeout': 'The side question timed out and was cancelled.',
  'error.incomplete': 'The side question did not complete ({reason}).{detail}',
  'error.noText': 'The model returned no text.',
  'error.cleanup': 'Cleanup failed. Close again to retry. {detail}',
  'error.cleanupTimeout': 'Resources are still being released. Try closing again shortly.',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'michengai.btw': MessageKey }
}

/** 服务端按请求语言生成提示；客户端使用宿主 locale.bind 和 slot 的 t。 */
export function translate(locale: BtwLocale = 'zh'): BtwTranslate {
  const dictionary = locale === 'zh' ? zh : en
  return (key, params) => dictionary[key].replace(/\{(\w+)\}/g, (match, name: string) => String(params?.[name] ?? match))
}

export function normalizeLocale(value: unknown): BtwLocale {
  return value === undefined || (typeof value === 'string' && /^zh(?:-|$)/i.test(value)) ? 'zh' : 'en'
}
