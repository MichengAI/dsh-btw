/** 设置面板读到的表单快照；形状跟随宿主 `ConfigFormController.getSnapshot()`。 */
export interface SettingsFormSnapshot {
    readonly status: 'idle' | 'loading' | 'ready' | 'unavailable';
    readonly value?: Readonly<Record<string, unknown>>;
    readonly writable?: boolean;
    readonly revision?: number;
}
/** 宿主控制器的最小面；只用得到这两件事，避免硬依赖宿主内部类型。 */
export interface HostConfigForm {
    getSnapshot(): SettingsFormSnapshot;
    subscribe?(listener: () => void): () => void;
    set?(field: string, value: unknown): Promise<boolean> | boolean;
    mutate?(ops: readonly {
        op: 'set';
        path: readonly string[];
        value: unknown;
    }[]): Promise<boolean> | boolean;
}
/** 宿主的 `configForms` 服务面。 */
export interface HostConfigForms {
    describe(): {
        getSnapshot(): {
            status?: string;
            view?: {
                namespaces?: readonly {
                    nsId?: string;
                    ns?: string;
                }[];
            };
        };
        subscribe?(listener: () => void): () => void;
        load?(): unknown;
    };
    get(entryId: string): HostConfigForm;
}
/** 卡片拿到的转发 scope：读永远读当前绑定的控制器，写永远写当前命名空间。 */
export interface BtwSettingsScope {
    getSnapshot(): SettingsFormSnapshot;
    subscribe(listener: () => void): () => void;
    setMany(pairs: readonly (readonly [string, unknown])[]): Promise<boolean | undefined>;
    /** 当前是否已经绑定了宿主真正在服务的命名空间。 */
    bound(): boolean;
}
/** 插件包名；行级配置 key 的前半段。 */
export declare const BUNDLE_NAME = "@michengai/dsh-btw";
/** `plugins.row.config` 的 key：`<包名>#<patch 行 id>`。 */
export declare const ROW_CONFIG_KEY = "@michengai/dsh-btw#michengai-btw";
/**
 * 在镜像列出的命名空间里挑出旁问自己的那个。
 *
 * 只挑宿主已经确认在服务的命名空间：猜一个不存在的 id 会得到一张「控件可用但保存全被拒」
 * 的卡片（宿主返回 `No configurable plugin entry "…"`）。
 */
export declare function pickNamespace(forms: HostConfigForms | undefined): string | undefined;
/**
 * 建一个转发 scope。
 *
 * 转发而不是绑死一个控制器：宿主镜像在 `apply()` 之后才陆续回答，绑死会让卡片永远指向
 * 一个还没被服务的命名空间；镜像每次变化都重新解析并重新绑定，卡片不需要重新注册。
 */
export declare function createSettingsScope(forms: HostConfigForms): BtwSettingsScope;
/** 把 textarea 里的白名单文本收敛成去重后的工具名数组；非法条目返回 `undefined`。 */
export declare function parseToolList(text: string): readonly string[] | undefined;
/** 把已保存的白名单数组还原成 textarea 文本。 */
export declare function formatToolList(value: unknown): string;
/** 提示词输入框的截断上限；与 Host 侧解析保持一致。 */
export declare function clampPrompt(value: unknown): string;
