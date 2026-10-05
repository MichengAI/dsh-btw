import type { CommandRuntime } from '@deepseek-ai/dsh-commands';
/** 兼容没有 hidden 选项的宿主：仅过滤目录，find/execute 仍由宿主处理。 */
export declare function hideInternalCommands(commands: Pick<CommandRuntime, 'list'>): () => void;
