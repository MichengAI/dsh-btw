import type { Agent } from '@deepseek-ai/dsh-agent';
/**
 * 上下文完整版 fork provider 的名称。
 * 与官方 `fork` 同契约，唯一区别：种子不只截到最后一个 `turn/end`，
 * 还会把父会话当前**尚未完成**的 turn（正在流出的思考、已发起的工具调用）
 * 一并纳入，并用宿主提供的收尾事件补齐成合法的会话前缀。
 */
export declare const CONTEXT_INCLUSIVE_FORK_PROVIDER = "michengai-btw-fork";
interface SessionEventLike {
    type: string;
    seq?: number;
    time?: number;
    data?: any;
}
type Closers = (events: readonly SessionEventLike[]) => readonly unknown[];
/**
 * 动态探测宿主是否导出 `interruptedTurnClosers`。
 * 旧宿主若没有该导出，静默退回「仅已完成轮次」的官方行为，
 * 不影响插件加载（因此不在模块顶层静态导入其命名导出）。
 */
export declare function loadInterruptedTurnClosers(): Promise<Closers | undefined>;
/**
 * 计算一次旁问的 fork 种子事件。
 *
 * - 父会话空闲（没有开放 turn）：与官方 fork 逐字节一致——只取到最后一个 `turn/end`，
 *   保持与主会话的 prompt cache 前缀一致。
 * - 父会话正处于未完成的 turn：在完整事件前缀之后追加宿主生成的收尾事件
 *   （未产生结果的工具调用 → 「结果未知」的合成工具结果，再补 `step/end`、`turn/end`），
 *   让种子成为合法、平衡的会话前缀，从而使旁问能看到当前的思考与工具调用。
 *
 * @param parent - 触发旁问的父 Agent。
 * @returns 种子事件；父会话尚无任何内容时为空数组。
 */
export declare function buildSideAskSeed(parent: Agent | undefined): Promise<readonly unknown[]>;
/**
 * 构造上下文完整版 fork provider：能力与官方 fork 完全一致，
 * 仅 `prepareContinuable` 的种子延伸到进行中的 step。
 */
export declare function createContextInclusiveForkProvider(): {
    name: string;
    capabilities: {
        agentOptions: boolean;
        agentPreset: boolean;
        outputSchema: boolean;
        depthLimit: boolean;
    };
    inheritsParentContext: boolean;
    prepareContinuable(request: {
        parent?: Agent;
    }): Promise<{
        seed: readonly unknown[];
    } | {
        seed?: undefined;
    }>;
};
export {};
