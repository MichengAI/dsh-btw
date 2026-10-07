import type { ComponentType } from 'react'

export interface HostMarkdownLabels {
  code: { copyLabel: string; copiedLabel: string }
  footnotes: string
}

export type HostMarkdownText = ComponentType<{
  text: string
  streaming?: boolean
  labels: HostMarkdownLabels
  variant?: 'body' | 'compact'
}>

declare function require(id: string): { MarkdownText?: unknown }

let cached: HostMarkdownText | null | undefined

function isHostMarkdown(value: unknown): value is HostMarkdownText {
  if (typeof value === 'function') return true
  return typeof value === 'object' && value !== null && '$$typeof' in value
}

/** 宿主基座模块。旧宿主没有它时返回 null，调用方改用自带 Markdown。 */
export function loadHostMarkdownText(): HostMarkdownText | null {
  if (cached !== undefined) return cached
  try {
    const loaded = require('@deepseek-ai/dsh-client-ui-primitives')
    cached = isHostMarkdown(loaded?.MarkdownText) ? loaded.MarkdownText : null
  } catch {
    cached = null
  }
  return cached
}
