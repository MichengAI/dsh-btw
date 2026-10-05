import { type SideResult } from '../shared';
import { type BtwTranslate } from '../locales';
export interface Bubble {
    id: string;
    sessionId: string;
    question: string;
    reference?: string;
    answer: string;
    phase: 'answering' | 'done' | 'error' | 'closing';
    error?: string;
    closeFailed?: boolean;
}
export interface SideTransport {
    run(session: string, id: string, question: string, signal: AbortSignal, reference?: string): Promise<SideResult>;
    close(session: string, id: string): Promise<SideResult>;
}
/** 仅内存 UI 状态；关闭请求与答案返回按请求身份分别收敛。 */
export declare class BubbleStore {
    private readonly transport;
    private readonly t;
    private snapshot;
    private readonly listeners;
    private readonly active;
    private readonly closing;
    private readonly admitting;
    private disposed;
    constructor(transport: SideTransport, t?: BtwTranslate);
    getSnapshot: () => readonly Bubble[];
    subscribe: (listener: () => void) => (() => void);
    /** 返回已接收请求的标识；满额先等待旧气泡关闭，失败时拒绝且不发送新问题。 */
    ask(sessionId: string, question: string, reference?: string): Promise<string>;
    close(id: string): Promise<void>;
    dispose(): Promise<void>;
    private update;
    private publish;
}
