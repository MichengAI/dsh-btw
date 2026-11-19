import type { Agent } from '@deepseek-ai/dsh-agent';
/**
 * 上下文完整版 fork provider 的名称。
 * 与官方 `fork` 同契约，区别在于：种子不只截到最后一个 `turn/end`，
 * 还会把父会话当前**尚未完成**的 turn（正在执行的工具调用）
 * 一并纳入，并使用宿主官方 `buildForkSeed` 产出的 `forked` 语义收尾事件补齐成合法的会话前缀。
 */
export declare const CONTEXT_INCLUSIVE_FORK_PROVIDER = "michengai-btw-fork";
/**
 * 计算一次旁问的 fork 种子事件。
 *
 * - 父会话空闲（没有开放 turn）：与官方 fork 逐字节一致——只取到最后一个 `turn/end`，
 *   保持与主会话的 prompt cache 前缀一致。
 * - 父会话正处于未完成的 turn：在完整事件前缀之后追加宿主 `forked` 收尾事件
 *   （未产生结果的工具调用 → 「forked 结果未知」的合成工具结果，再补 `step/end`、`turn/end (reason: forked)`），
 *   并规整 seq 保持连续递增，让种子成为合法、平衡的会话前缀，从而使旁问能看到当前轮次的提问与进行中的工具调用。
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
