import type { CommandRuntime } from '@deepseek-ai/dsh-commands'
import { CLOSE_COMMAND, RUN_COMMAND } from '../shared'

/** 兼容没有 hidden 选项的宿主：仅过滤目录，find/execute 仍由宿主处理。 */
export function hideInternalCommands(commands: Pick<CommandRuntime, 'list'>): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(commands, 'list')
  const original = commands.list
  let active = true
  const filtered: typeof original = function (this: Pick<CommandRuntime, 'list'>, agent) {
    const rows = original.call(this, agent)
    return active ? Object.freeze(rows.filter(row => row.name !== RUN_COMMAND && row.name !== CLOSE_COMMAND)) : rows
  }
  Object.defineProperty(commands, 'list', { configurable: true, writable: true, value: filtered })
  return () => {
    active = false
    // 其他插件若后来包装了本方法，保留它；被其持有的旧过滤器也停止过滤。
    if (Object.getOwnPropertyDescriptor(commands, 'list')?.value !== filtered) return
    if (descriptor) Object.defineProperty(commands, 'list', descriptor)
    else Reflect.deleteProperty(commands, 'list')
  }
}
