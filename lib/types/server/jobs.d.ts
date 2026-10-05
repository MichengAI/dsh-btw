import type { SideResult } from '../shared';
import { type BtwLocale } from '../locales';
export interface ChildResult {
    stopReason: string;
    output: readonly {
        type: string;
        text?: string;
    }[];
}
export interface ChildRun {
    result: Promise<ChildResult>;
    dispose(): Promise<void>;
}
export interface ChildRequest {
    scope: string;
    id: string;
    question: string;
    signal: AbortSignal;
    toolFilter: {
        allow: readonly string[];
    };
    context?: unknown;
    locale: BtwLocale;
}
export type StartChild = (request: ChildRequest) => Promise<ChildRun>;
interface JobOptions {
    cleanupTimeoutMs?: number;
    onError?: (error: Error) => void;
    /** 卸载后所有实际资源均释放时调用；用于释放执行保护。 */
    onIdle?: () => void | Promise<void>;
}
/** 管理一次性任务；父会话和请求标识共同构成所有权边界。 */
export declare class SideJobs {
    private readonly start;
    private readonly timeoutMs;
    private readonly options;
    private readonly jobs;
    private readonly retired;
    private disposed;
    private idleNotified;
    constructor(start: StartChild, timeoutMs?: number, options?: JobOptions);
    get size(): number;
    ask(scope: string, id: string, question: string, signal?: AbortSignal, context?: unknown, locale?: BtwLocale): Promise<SideResult>;
    /** 关闭可先于启动到达；短期墓碑阻止网络乱序重新启动请求。 */
    close(scope: string, id: string): Promise<SideResult>;
    dispose(): Promise<void>;
    private execute;
    private cleanup;
    private cleanupLater;
    private interruptible;
    private bounded;
    private release;
    private report;
    private notifyIdle;
    private retire;
    private prune;
}
export {};
