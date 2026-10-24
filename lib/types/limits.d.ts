/**
 * UTF-16 长度上限约束，供协议校验、界面文案与状态机共享：
 * - MAX_QUESTION_LENGTH: 单次提问文本上限（8,000 字符）
 * - MAX_REFERENCE_LENGTH: 单次划词选区原文上限（8,000 字符，单条引用与旁问共用）
 * - MAX_TOTAL_QUOTES_LENGTH: 会话草稿内多条引用合计总长度上限（16,000 字符，最多容纳多条选区参考）
 */
export declare const MAX_QUESTION_LENGTH = 8000;
export declare const MAX_REFERENCE_LENGTH = 8000;
export declare const MAX_TOTAL_QUOTES_LENGTH = 16000;
/**
 * 旁问子代理的输出预算上限（completion tokens）。
 *
 * 旁问会继承整段主任务上下文；如果同时继承主任务的 max_tokens（例如 1M 窗口路由上的
 * 256,000），「继承的历史 + 输出预留」很容易越过上游窗口，表现为 HTTP 400
 * (`requested N tokens (X in the messages, Y in the completion)`)。
 * 旁问只做一次性只读回答，不需要主任务级别的输出预算，因此固定压到 32,000：
 * 既够写长答案，也给历史留出余量；确需更大预算时可在此调整。
 */
export declare const SIDE_MAX_OUTPUT_TOKENS = 32000;
