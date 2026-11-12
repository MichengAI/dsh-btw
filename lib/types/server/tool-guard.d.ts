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
/** 读取当前旁问在协作树中的直接父代理名（如 `'lead'` 或路径名），仅在宿主提供命名路由时存在。 */
export type ParentNameOf = (agent: AgentIdentity, parentSession: string) => string | undefined;
export interface SubagentMemberNamesLike {
    readonly self?: unknown;
    readonly parent?: unknown;
}
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
 * 工具白名单的读取函数。
 *
 * 用 getter 而不是快照：配置项在设置面板里是可写的，用户在面板里改完就应在下一次
 * 旁问里生效，不需要重载插件。返回空数组表示「只放行 send_message」。
 */
export type AllowedToolsOf = () => readonly string[];
/** 官方替换同步事件扫描：ctx.sessionProjections.snapshot(session, ['subagent']).values.subagent */
export declare function identityOfFromContext(ctx: {
    get(name: string): unknown;
}): IdentityOf | undefined;
/**
 * 从宿主 `subagents` 服务读取旁问直接父会话的模型侧名称（0.2.2-rc.2+）。
 * 必须通过服务实例方法调用以保留 Cordis 代理的 `this` 上下文；当 `namesOf` 不可用时，
 * 仅在 `rootOf(agent)` 确认为直接父会话（`root !== agent && root.id === parentSession`）时返回 `'lead'`，
 * 避免二级子代理误将 `'lead'` 解析到祖父/树根。
 */
export declare function parentNameOfFromContext(ctx: {
    get(name: string): unknown;
}): ParentNameOf | undefined;
/** 空白名单过滤继承工具；本保护额外拒绝 PTC 及子作用域自注册工具。 */
export declare function createAnswerOnlyGuard(labels: ReadonlySet<string>, identityOf?: IdentityOf, allowedTools?: AllowedToolsOf, parentNameOf?: ParentNameOf): AnswerOnlyGuard;
