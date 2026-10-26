export interface SessionEventLike {
    readonly type: string;
    readonly data?: unknown;
}
export interface SessionIdentityHint {
    snapshotEvents?(): readonly SessionEventLike[];
}
export interface AgentIdentity {
    session?: object;
}
export interface SubagentIdentityHint {
    readonly label?: string;
}
export type IdentityOf = (session: object) => SubagentIdentityHint | null | undefined;
/**
 * The single inherited tool a side ask may call, and only addressed at its own
 * parent. Reusing the host's `send_message` — rather than registering a new
 * side-ask tool — keeps the side-ask request's tool list byte-identical to the
 * parent's, which is what makes the prompt cache reusable
 * (`tests/cache-prefix.test.ts`).
 */
export declare const REPLY_TOOL = "send_message";
export interface AnswerOnlyGuard {
    (execution: {
        agent?: AgentIdentity;
        name?: string;
        arguments?: unknown;
    }): string | undefined;
    own(agent: object): void;
    recognize(session: object, event: SessionEventLike): void;
}
/** The parent session a side-ask child could return an answer to, when it has one. */
export declare function parentSessionOf(agent: AgentIdentity | undefined): string | undefined;
/** 官方替换同步事件扫描：ctx.sessionProjections.snapshot(session, ['subagent']).values.subagent */
export declare function identityOfFromContext(ctx: {
    get(name: string): unknown;
}): IdentityOf | undefined;
/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具，只放行发回父会话的 send_message。 */
export declare function createAnswerOnlyGuard(labels: ReadonlySet<string>, identityOf?: IdentityOf): AnswerOnlyGuard;
