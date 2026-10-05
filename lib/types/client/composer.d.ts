import type { BtwTranslate } from '../locales';
interface DraftInput {
    state: {
        getSnapshot(): {
            draft: string;
            phase: string;
        };
    };
    setDraft(text: string): void;
    focus?(): void;
}
/** 固定追加引用，保留原草稿；统一引用内部换行，正文空白不裁剪。 */
export declare function appendQuote(draft: string, reference: string): string;
/** 提交事务期间不改写草稿；成功写入后把键盘交回宿主输入框。 */
export declare function addQuoteToComposer(input: DraftInput, reference: string, t: BtwTranslate): void;
export {};
