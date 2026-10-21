export interface CapturedSelectionDetails {
  text: string
  role: 'user' | 'assistant'
  turnIndex?: number
  element: Element
}

/** 提取选区及关联出处元数据（角色、轮次、锚点节点）。 */
export function captureSelectionDetails(scope: HTMLElement, target: Element): CapturedSelectionDetails | undefined {
  const selection = scope.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return
  const range = selection.getRangeAt(0)
  const element = (node: Node) => node.nodeType === 1 ? node as Element : node.parentElement
  const start = element(range.startContainer)
  const end = element(range.endContainer)
  // 真实 Chat 渲染节点为 assistant-step；assistant 是消息层名称，兼容保留旧布局。
  const row = start?.closest('[data-chat-flow-kind="assistant-step"], [data-chat-flow-kind="assistant"], [data-chat-flow-kind="user"]')
  if (!row || !scope.contains(row) || !end || !row.contains(end) || !row.contains(target)) return
  const excluded = 'input, textarea, button, [contenteditable]:not([contenteditable="false"]), [hidden], [data-turn-process-inline]'
  if ([start, end, target].some(node => node?.closest(excluded))) return
  const text = selection.toString().trim()
  if (!text) return

  const kind = row.getAttribute('data-chat-flow-kind')
  const role: 'user' | 'assistant' = kind === 'user' ? 'user' : 'assistant'

  // 计算会话逻辑轮次：连续同类角色归为一轮交互
  let userTurn = 0
  let assistantTurn = 0
  let currentRole: 'user' | 'assistant' | null = null
  let turnIndex: number | undefined

  const rows = Array.from(scope.querySelectorAll('[data-chat-flow-kind]'))
  for (const r of rows) {
    const k = r.getAttribute('data-chat-flow-kind')
    const rRole: 'user' | 'assistant' | null = k === 'user' ? 'user' : (k === 'assistant' || k === 'assistant-step') ? 'assistant' : null
    if (!rRole) continue
    if (rRole !== currentRole) {
      currentRole = rRole
      if (rRole === 'user') userTurn++
      else assistantTurn++
    }
    if (r === row) {
      turnIndex = rRole === 'user' ? userTurn : assistantTurn
      break
    }
  }

  return { text, role, turnIndex, element: row }
}

/** 仅接入宿主有明确标记的单条正文；未知布局保留浏览器原有行为。 */
export function captureSelection(scope: HTMLElement, target: Element): string | undefined {
  return captureSelectionDetails(scope, target)?.text
}
