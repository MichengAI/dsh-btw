import type { Context } from '@deepseek-ai/cordis';
export declare const name = "michengai-btw";
export declare const inject: string[];
export { Config } from './server/settings';
/** 宿主命令只负责接入与身份绑定，不创建 HTTP 或持久侧聊接口。 */
export declare function apply(ctx: Context, config?: unknown): void;
