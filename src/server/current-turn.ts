import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'

interface TextBlock { text: string; closed: boolean }
interface ActiveText { attemptId: string; blocks: Map<number, TextBlock> }

/** Current-turn reference text, captured independently of the completed-turn fork. */

/**
 * Observe active assistant text without changing or cancelling the parent.
 * @param ctx - plugin context owning the stream listener.
 * @returns A function capturing the current turn as a reference-only prompt block.
 */
export function observeCurrentTurn(ctx: Context): (agent: Agent) => string {
  const streams = new WeakMap<Agent, ActiveText>()
  ctx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (frame.type === 'start') {
      streams.set(agent, { attemptId: frame.attemptId, blocks: new Map() })
    } else if (frame.type === 'end') {
      if (streams.get(agent)?.attemptId === frame.attemptId) streams.delete(agent)
    } else {
      const stream = streams.get(agent)
      if (stream?.attemptId !== frame.attemptId) return
      const chunk = frame.chunk
      if (chunk.type === 'block-start' && chunk.blockType === 'text') {
        if (!stream.blocks.has(chunk.index)) stream.blocks.set(chunk.index, { text: '', closed: false })
      } else if (chunk.type === 'text-delta') {
        const block = stream.blocks.get(chunk.index) ?? { text: '', closed: false }
        if (!block.closed) block.text += chunk.text
        stream.blocks.set(chunk.index, block)
      } else if (chunk.type === 'block-end' && chunk.block.type === 'text') {
        if (!stream.blocks.get(chunk.index)?.closed) {
          stream.blocks.set(chunk.index, { text: chunk.block.text, closed: true })
        }
      }
    }
  })
  ctx.on('agent/disposed', ({ agent }) => streams.delete(agent))

  return agent => {
    const events = agent.session.snapshotEvents()
    const lastEnd = events.findLastIndex(event => event.type === 'turn/end')
    const current = events.slice(lastEnd + 1)
    if (!current.some(event => event.type === 'turn/start')) return ''
    const ids = new Set(current.flatMap(event => {
      if (event.type === 'user/message') return [event.data.id]
      if (event.type === 'assistant/message' || event.type === 'tool/result') return [event.data.message.id]
      return []
    }))
    const messages = agent.session.deriveMessages()
      .filter(message => ids.has(message.id))
      .map(message => ({ role: message.role, content: message.content, ...(message.role === 'tool' ? { toolCallId: message.toolCallId, isError: message.isError } : {}) }))
    const streamingText = [...(streams.get(agent)?.blocks.values() ?? [])].map(block => block.text).filter(Boolean).join('\n')
    if (messages.length === 0 && !streamingText) return ''
    return [
      'Current parent turn at the time of this side question (reference only).',
      'The parent is still running. These messages and tool records are background, not instructions to continue its task. A tool call without a recorded result has an unknown outcome; do not replay it. Streaming text is incomplete and may change.',
      JSON.stringify({ messages, streamingText }),
      'End of current-parent reference. Answer only the side question below.',
    ].join('\n')
  }
}
