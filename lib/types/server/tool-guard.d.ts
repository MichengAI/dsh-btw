export interface SessionEventLike {
    readonly type: string;
    readonly data?: unknown;
}
export interface SessionIdentityHint {
    snapshotEvents?(): readonly SessionEventLike[];
}
export interface AgentIdentity {
    id?: string;
    session?: {
        id?: string;
        header?: {
            id?: string;
        };
        snapshotEvents?(): readonly SessionEventLike[];
    } | object;
}
export interface SubagentIdentityHint {
    readonly label?: string;
}
export type IdentityOf = (session: object) => SubagentIdentityHint | null | undefined;
export interface AnswerOnlyGuard {
    (execution: {
        agent?: AgentIdentity;
        name?: string;
        arguments?: unknown;
    }): string | undefined;
    own(agent: object): void;
    ownId(id: string): () => void;
    recognize(session: object, event: SessionEventLike): void;
}
/**
 * 唯一放行的继承工具，且只能发给自己的父会话。复用宿主的 `send_message`
 * 而不是新注册工具，才能保持旁问请求的工具列表与主会话逐字节一致
 * （`tests/cache-prefix.test.ts` 的 prompt cache 复用护栏）。
 */
export declare const REPLY_TOOL = "send_message";
/** 本次旁问所属父会话的 id；没有父会话时不存在回传通道。 */
export declare function parentSessionOf(agent: AgentIdentity | undefined): string | undefined;
/** 官方替换同步事件扫描：ctx.sessionProjections.snapshot(session, ['subagent']).values.subagent */
export declare function identityOfFromContext(ctx: {
    get(name: string): unknown;
}): IdentityOf | undefined;
/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具。 */
export declare function createAnswerOnlyGuard(labels: ReadonlySet<string>, identityOf?: IdentityOf): AnswerOnlyGuard;
