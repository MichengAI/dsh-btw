/**
 * UTF-16 长度上限约束，供协议校验、界面文案与状态机共享：
 * - MAX_QUESTION_LENGTH: 单次提问文本上限（8,000 字符）
 * - MAX_REFERENCE_LENGTH: 单次划词选区原文上限（8,000 字符，单条引用与旁问共用）
 * - MAX_TOTAL_QUOTES_LENGTH: 会话草稿内多条引用合计总长度上限（16,000 字符，最多容纳多条选区参考）
 */
export const MAX_QUESTION_LENGTH = 8_000
export const MAX_REFERENCE_LENGTH = 8_000
export const MAX_TOTAL_QUOTES_LENGTH = 16_000
