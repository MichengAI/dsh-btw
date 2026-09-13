/** 仅接入宿主有明确标记的单条正文；未知布局保留浏览器原有行为。 */
export function captureSelection(scope: HTMLElement, target: Element): string | undefined {
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
  const text = selection.toString()
  return text.trim() ? text : undefined
}
