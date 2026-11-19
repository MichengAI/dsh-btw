import type { Agent } from '@deepseek-ai/dsh-agent'

/**
 * 上下文完整版 fork provider 的名称。
 * 与官方 `fork` 同契约，区别在于：种子不只截到最后一个 `turn/end`，
 * 还会把父会话当前**尚未完成**的 turn（正在执行的工具调用）
 * 一并纳入，并使用宿主官方 `buildForkSeed` 产出的 `forked` 语义收尾事件补齐成合法的会话前缀。
 */
export const CONTEXT_INCLUSIVE_FORK_PROVIDER = 'michengai-btw-fork'

interface SessionEventLike {
  type: string
  seq?: number
  time?: number
  data?: any
}

type BuildForkSeedFn = (events: readonly SessionEventLike[], boundary: number) => readonly SessionEventLike[]
type InterruptedClosersFn = (events: readonly SessionEventLike[]) => readonly SessionEventLike[]

let buildForkSeedPromise: Promise<BuildForkSeedFn | undefined> | undefined
let closersPromise: Promise<InterruptedClosersFn | undefined> | undefined

/**
 * 动态探测宿主是否导出 `buildForkSeed`。
 * 使用官方 fork 语义生成收尾事件（turn/end reason 为 `forked`，且模型可见文案明确告知父会话可能在 fork 点后完成该工具）。
 */
function loadBuildForkSeed(): Promise<BuildForkSeedFn | undefined> {
  buildForkSeedPromise ??= import('@deepseek-ai/dsh-session')
    .then((mod: any) => (typeof mod?.buildForkSeed === 'function' ? (mod.buildForkSeed as BuildForkSeedFn) : undefined))
    .catch(() => {
      buildForkSeedPromise = undefined
      return undefined
    })
  return buildForkSeedPromise
}

/**
 * 动态探测宿主是否导出 `interruptedTurnClosers`。
 * 作为老版宿主缺少 `buildForkSeed` 时的备选降级方案。
 */
function loadInterruptedTurnClosers(): Promise<InterruptedClosersFn | undefined> {
  closersPromise ??= import('@deepseek-ai/dsh-session')
    .then((mod: any) => (typeof mod?.interruptedTurnClosers === 'function' ? (mod.interruptedTurnClosers as InterruptedClosersFn) : undefined))
    .catch(() => {
      closersPromise = undefined
      return undefined
    })
  return closersPromise
}

/** 最后一个 `turn/end` 的下标；不存在时返回 -1。 */
function lastTurnEndIndex(events: readonly SessionEventLike[]): number {
  for (let i = events.length - 1; i >= 0; i--) if (events[i]?.type === 'turn/end') return i
  return -1
}

/** 日志尾部是否存在一个尚未以 `turn/end` 收尾的开放 turn。 */
function hasOpenTurn(events: readonly SessionEventLike[]): boolean {
  let open = false
  for (const event of events) {
    if (event?.type === 'turn/start') open = true
    else if (event?.type === 'turn/end') open = false
  }
  return open
}

/**
 * 计算一次旁问的 fork 种子事件。
 *
 * - 父会话空闲（没有开放 turn）：与官方 fork 逐字节一致——只取到最后一个 `turn/end`，
 *   保持与主会话的 prompt cache 前缀一致。
 * - 父会话正处于未完成的 turn：在完整事件前缀之后追加宿主 `forked` 收尾事件
 *   （未产生结果的工具调用 → 「forked 结果未知」的合成工具结果，再补 `step/end`、`turn/end (reason: forked)`），
 *   并规整 seq 保持连续递增，让种子成为合法、平衡的会话前缀，从而使旁问能看到当前轮次的提问与进行中的工具调用。
 *
 * @param parent - 触发旁问的父 Agent。
 * @returns 种子事件；父会话尚无任何内容时为空数组。
 */
export async function buildSideAskSeed(parent: Agent | undefined): Promise<readonly unknown[]> {
  const session: any = (parent as any)?.session
  const events: readonly SessionEventLike[] | undefined = session?.snapshotEvents?.()
  if (!Array.isArray(events) || events.length === 0) return []

  if (!hasOpenTurn(events)) {
    const end = lastTurnEndIndex(events)
    return end === -1 ? [] : events.slice(0, end + 1)
  }

  // 架构决策说明：PR #28 原草案包含 guardRecall（针对 @deepseek-ai/dsh-llm 中的 dshGoRecall 会话保护）。
  // 经宿主全矩阵（0.2.2-alpha.2 ~ 0.2.2-rc.5）实测比对：
  // 1. 宿主当前并没有导出 dshGoRecall，也无 dshGoRecallHistory 属性；
  // 2. companion-recall 会话在官方 fork provider 中同样未设此类门控。
  // 故此处无需引入无用的死代码探测，后续若宿主新增 recall 门控契约再做针对性适配。
  try {
    const buildFork = await loadBuildForkSeed()
    if (buildFork !== undefined) {
      const boundary = events.length - 1
      const raw = buildFork(events, boundary)
      const seed = Array.from(raw)
      // buildForkSeed 会在 boundary 之后插入一个 session/end-seed 标记。
      // 在 subagent manager 创建子 session 时，会将 seed 整体作为 constructor seed 传入，
      // 并在 seed.length 处统一追加 session/end-seed。为保持 seed 的连续性和单一标记契约，
      // 移除中间的 end-seed 标记，并将后续收尾事件的 seq 压回连续。
      const markerIndex = boundary + 1
      if (seed[markerIndex]?.type === 'session/end-seed') {
        seed.splice(markerIndex, 1)
        for (let i = markerIndex; i < seed.length; i++) {
          const item = seed[i]
          if (item && item.seq !== i) {
            seed[i] = { ...item, seq: i }
          }
        }
      }
      return seed
    }

    const close = await loadInterruptedTurnClosers()
    if (close !== undefined) {
      return events.concat(close(events))
    }
  } catch {
    // 宿主 fork 逻辑异常或收尾失败时安全降级至已完成轮次
  }

  // 宿主不提供收尾能力或构造异常时保持官方行为，避免产出非法种子。
  const end = lastTurnEndIndex(events)
  return end === -1 ? [] : events.slice(0, end + 1)
}

/**
 * 构造上下文完整版 fork provider：能力与官方 fork 完全一致，
 * 仅 `prepareContinuable` 的种子延伸到进行中的 step。
 */
export function createContextInclusiveForkProvider() {
  return {
    name: CONTEXT_INCLUSIVE_FORK_PROVIDER,
    capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true },
    inheritsParentContext: true,
    async prepareContinuable(request: { parent?: Agent }) {
      const seed = await buildSideAskSeed(request.parent)
      return seed.length > 0 ? { seed } : {}
    },
  }
}
