import type { BtwTranslate } from '../locales'

interface DraftInput {
  state: { getSnapshot(): { draft: string; phase: string } }
  setDraft(text: string): void
  focus?(): void
}

/** 固定追加引用，保留原草稿；统一引用内部换行，正文空白不裁剪。 */
export function appendQuote(draft: string, reference: string): string {
  const quote = reference.split(/\r\n|\r|\n/).map(line => `> ${line}`).join('\n')
  const separator = !draft || /(?:\r?\n){2}$/.test(draft) ? '' : /[\r\n]$/.test(draft) ? '\n' : '\n\n'
  return `${draft}${separator}${quote}\n\n`
}

/** 提交事务期间不改写草稿；成功写入后把键盘交回宿主输入框。 */
export function addQuoteToComposer(input: DraftInput, reference: string, t: BtwTranslate): void {
  const snapshot = input.state.getSnapshot()
  if (snapshot.phase === 'adjudicating' || snapshot.phase === 'submitting') throw new Error(t('error.composerBusy'))
  input.setDraft(appendQuote(snapshot.draft, reference))
  input.focus?.()
}
