import { MAX_PROMPT_LENGTH, MAX_TOOL_NAME_LENGTH } from '../limits'

/** 设置面板读到的表单快照；形状跟随宿主 `ConfigFormController.getSnapshot()`。 */
export interface SettingsFormSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'unavailable'
  readonly value?: Readonly<Record<string, unknown>>
  readonly writable?: boolean
  readonly revision?: number
}

/** 宿主控制器的最小面；只用得到这两件事，避免硬依赖宿主内部类型。 */
export interface HostConfigForm {
  getSnapshot(): SettingsFormSnapshot
  subscribe?(listener: () => void): () => void
  set?(field: string, value: unknown): Promise<boolean> | boolean
  mutate?(ops: readonly { op: 'set'; path: readonly string[]; value: unknown }[]): Promise<boolean> | boolean
}

/** 宿主的 `configForms` 服务面。 */
export interface HostConfigForms {
  describe(): { getSnapshot(): { status?: string; view?: { namespaces?: readonly { nsId?: string; ns?: string }[] } }; subscribe?(listener: () => void): () => void; load?(): unknown }
  get(entryId: string): HostConfigForm
}

/** 卡片拿到的转发 scope：读永远读当前绑定的控制器，写永远写当前命名空间。 */
export interface BtwSettingsScope {
  getSnapshot(): SettingsFormSnapshot
  subscribe(listener: () => void): () => void
  setMany(pairs: readonly (readonly [string, unknown])[]): Promise<boolean | undefined>
  /** 当前是否已经绑定了宿主真正在服务的命名空间。 */
  bound(): boolean
}

/** 旁问插件在 Loader 里的 patch 行 id（`cordis.patch.yml` 的 `id:`）。 */
const ROW_ID = 'michengai-btw'
/** 插件包名；行级配置 key 的前半段。 */
export const BUNDLE_NAME = '@michengai/dsh-btw'
/** `plugins.row.config` 的 key：`<包名>#<patch 行 id>`。 */
export const ROW_CONFIG_KEY = `${BUNDLE_NAME}#${ROW_ID}`

/** 一次强制重读镜像的重试次数与间隔：镜像相对 `apply()` 是异步的，一次读可能永远空。 */
const MIRROR_LOAD_ATTEMPTS = 6
const MIRROR_LOAD_DELAY_MS = 300

function namespaceOf(entry: unknown): string | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined
  const value = entry as { ns?: unknown; nsId?: unknown }
  if (typeof value.ns === 'string') return value.ns
  if (typeof value.nsId === 'string') return value.nsId
  return undefined
}

/**
 * 在镜像列出的命名空间里挑出旁问自己的那个。
 *
 * 只挑宿主已经确认在服务的命名空间：猜一个不存在的 id 会得到一张「控件可用但保存全被拒」
 * 的卡片（宿主返回 `No configurable plugin entry "…"`）。
 */
export function pickNamespace(forms: HostConfigForms | undefined): string | undefined {
  if (!forms) return undefined
  let listed: readonly unknown[] = []
  try {
    listed = forms.describe().getSnapshot().view?.namespaces ?? []
  } catch {
    return undefined
  }
  const names = listed.map(namespaceOf).filter((ns): ns is string => ns !== undefined)
  return names.find(ns => ns === ROW_ID)
    ?? names.find(ns => ns === `include:${ROW_ID}`)
    ?? names.find(ns => ns === BUNDLE_NAME)
    ?? names.find(ns => /(?:^|[#:/-])michengai-btw$/.test(ns))
    ?? undefined
}

/**
 * 建一个转发 scope。
 *
 * 转发而不是绑死一个控制器：宿主镜像在 `apply()` 之后才陆续回答，绑死会让卡片永远指向
 * 一个还没被服务的命名空间；镜像每次变化都重新解析并重新绑定，卡片不需要重新注册。
 */
export function createSettingsScope(forms: HostConfigForms): BtwSettingsScope {
  let current: HostConfigForm | undefined
  let currentOff: (() => void) | undefined
  let attempts = 0
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of listeners) listener() }

  // `getSnapshot` 是 React 的 `useSyncExternalStore` 契约：同一个 revision 必须返回
  // 同一个对象，否则每次渲染都判定「变了」而无限重渲染。宿主的控制器理论上会缓存，
  // 但它是可替换的第三方实现，这里自己兜一层。
  // 未绑定时的快照也必须是常量：每次新建对象会让 React 认为 store 一直在变。
  const UNBOUND: SettingsFormSnapshot = { status: 'unavailable', writable: false }
  let cached: SettingsFormSnapshot | undefined
  const snapshot = (): SettingsFormSnapshot => {
    if (!current) return UNBOUND
    let next: SettingsFormSnapshot
    try { next = current.getSnapshot() } catch { return UNBOUND }
    if (cached !== undefined && cached.status === next.status && cached.writable === next.writable && cached.revision === next.revision) {
      return cached
    }
    cached = next
    return cached
  }

  const rebind = (): void => {
    const namespace = pickNamespace(forms)
    let next: HostConfigForm | undefined
    if (namespace !== undefined) {
      try { next = forms.get(namespace) } catch { next = undefined }
    }
    if (next === current) return
    currentOff?.()
    current = next
    cached = undefined
    currentOff = next?.subscribe?.(notify)
    notify()
  }

  const scheduleLoad = (): void => {
    if (attempts >= MIRROR_LOAD_ATTEMPTS) return
    attempts += 1
    try {
      const mirror = forms.describe()
      void Promise.resolve(mirror.load?.()).catch(() => undefined).then(() => {
        if (current !== undefined) return
        if (attempts >= MIRROR_LOAD_ATTEMPTS) return
        if (typeof setTimeout === 'function') setTimeout(rebind, MIRROR_LOAD_DELAY_MS)
        else rebind()
      })
    } catch { /* 镜像不可用：卡片保持只读 */ }
  }

  rebind()
  try {
    forms.describe().subscribe?.(() => { rebind(); if (current === undefined) scheduleLoad() })
  } catch { /* 没有镜像面：卡片保持只读 */ }
  if (current === undefined) scheduleLoad()

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setMany(pairs) {
      if (!current) return Promise.resolve(undefined)
      const ops = pairs.map(([field, value]) => ({ op: 'set' as const, path: [field], value }))
      try {
        // 一次原子写：分六次 set 会各自取一次 revision，中间的重载会让后面的字段校验失败。
        if (typeof current.mutate === 'function') return Promise.resolve(current.mutate(ops))
        if (typeof current.set === 'function') {
          return Promise.all(pairs.map(([field, value]) => Promise.resolve(current!.set!(field, value)))).then(results => results.every(Boolean))
        }
        return Promise.resolve(undefined)
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },
    bound() { return current !== undefined },
  }
}

/** 把 textarea 里的白名单文本收敛成去重后的工具名数组；非法条目返回 `undefined`。 */
export function parseToolList(text: string): readonly string[] | undefined {
  const names: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.trim()
    if (!name) continue
    if (/\s/.test(name) || name.includes(',') || name.length > MAX_TOOL_NAME_LENGTH) return undefined
    if (seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

/** 把已保存的白名单数组还原成 textarea 文本。 */
export function formatToolList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((entry): entry is string => typeof entry === 'string').join('\n')
}

/** 提示词输入框的截断上限；与 Host 侧解析保持一致。 */
export function clampPrompt(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_PROMPT_LENGTH) : ''
}
