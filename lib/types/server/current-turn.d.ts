import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
/** Current-turn reference text, captured independently of the completed-turn fork. */
/**
 * Observe active assistant text without changing or cancelling the parent.
 * @param ctx - plugin context owning the stream listener.
 * @returns A function capturing the current turn as a reference-only prompt block.
 */
export declare function observeCurrentTurn(ctx: Context): (agent: Agent) => string;
