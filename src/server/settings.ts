import z from '@deepseek-ai/schemastery'

import { MAX_PROMPT_LENGTH, MAX_TOOL_NAME_LENGTH } from '../limits'

/**
 * 旁问的可配置项：工具白名单与自定义提示词。
 *
 * 这里的字段在 Settings 面板里以「插件行 → 配置」的形式出现（位置与
 * `dsh-subagent-default-model` 相同）。三条约束来自宿主 `dsh-settings` 的实现，
 * 少一条都会让配置项「看得见但存不进」或「干脆不出现」：
 *
 * 1. 每个字段都必须带 `.default(...)`。`projectForm()` 会丢掉 resolved 为
 *    `undefined` 的字段（`return field === void 0 ? [] : [[key, projectForm(child, field)]]`），
 *    卡片随后会报一个极具误导性的 `notApplied:ready:writable=true`。
 * 2. 每个可配置字段都必须 volatile。`volatileForm()` 在没有任何 volatile 字段时返回
 *    `undefined`，`describe()` 随后直接 `return []`，整个 entry 从设置命名空间消失；
 *    写入非 volatile 路径则抛 `Config field "…" is not volatile`。
 * 3. 默认值必须等价于「不配置」：白名单为空、自定义提示词为空，与 1.1.1 的行为完全一致。
 */

/**
 * 把字段标记为 volatile，兼容不同 schemastery 版本。
 *
 * `volatile()` 是 schemastery 3.18.4 才有的糖；更早的版本用 `extra('volatile', true)`
 * 写入同一个 meta 键。两者产生同一个标记，因此不需要二次判断。
 *
 * @param schema - 一个 schemastery 字段。
 * @returns 已标记 volatile 的字段（宿主不支持时原样返回）。
 */
export function volatileField<T extends { meta?: { volatile?: boolean } }>(schema: T): T {
  const candidate = schema as T & {
    volatile?: () => T
    extra?: (key: string, value: unknown) => T
  }
  if (typeof candidate?.volatile === 'function') return candidate.volatile()
  if (typeof candidate?.extra === 'function' && candidate.meta?.volatile !== true) return candidate.extra('volatile', true)
  return schema
}

/** 白名单条目上限；只用于限制误操作，不是安全边界（真正的边界是执行期闸门）。 */
const MAX_ALLOWED_TOOLS = 64

export const Config = z.object({
  allowedTools: volatileField(z.array(z.string()).default([]).description(
    'Tools the side question may call besides send_message, one tool name each (for example pele_draw). Empty keeps the default text-only behaviour.',
  )),
  promptPrefix: volatileField(z.string().default('').description(
    'Instruction text that replaces the built-in side-question prompt. Empty keeps the built-in prompt; the tool-permission sentence is always appended.',
  )),
}).default({})

/** 解析后的配置：只保留执行期真正会用到的两个值。 */
export interface BtwSettings {
  /** 除 send_message 之外允许调用的工具名（已去重、去空、截断）。 */
  readonly allowedTools: readonly string[]
  /** 覆盖内置提示词的自定义指令；空串表示使用内置文案。 */
  readonly promptPrefix: string
}

const EMPTY: BtwSettings = { allowedTools: [], promptPrefix: '' }

/** Volatile 字段到达插件时可能是 cosmokit 的引用对象，读值前必须解包。 */
function unwrap(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function') {
    return (value as { get: () => unknown }).get()
  }
  return value
}

function normalizeTools(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const name = entry.trim()
    if (!name || name.length > MAX_TOOL_NAME_LENGTH) continue
    seen.add(name)
    if (seen.size >= MAX_ALLOWED_TOOLS) break
  }
  return [...seen]
}

/**
 * 把宿主交进来的 Config 收敛成执行期配置。
 *
 * 每次调用都重新解包，因为 volatile 字段是活的：用户在设置面板里改完立即生效，
 * 不需要重载插件。任何形状异常都退回默认值——配置读不出来不应该让旁问失败。
 */
export function readSettings(raw: unknown): BtwSettings {
  if (raw === undefined || raw === null || typeof raw !== 'object') return EMPTY
  const fields = raw as { allowedTools?: unknown; promptPrefix?: unknown }
  const allowedTools = normalizeTools(unwrap(fields.allowedTools))
  const prompt = unwrap(fields.promptPrefix)
  const promptPrefix = typeof prompt === 'string' ? prompt.trim().slice(0, MAX_PROMPT_LENGTH) : ''
  if (allowedTools.length === 0 && promptPrefix === '') return EMPTY
  return { allowedTools, promptPrefix }
}
