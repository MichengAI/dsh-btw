import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUp, MessageSquare, PanelLeft, Plus } from 'lucide-react'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { apply as applyHost } from '../src/index'
import { apply as applyClient } from '../src/client/index'
import { NS } from '../src/locales'
import { LocaleRuntime, themeCSS } from 'virtual:btw-host'
import './preview.css'
import './theme.css'

const commands = new Map<string, CommandDefinition>()
const noop = () => {}
const locale = new LocaleRuntime({ emit: noop } as unknown as Context)
locale.setLocale('zh')
const themeStyle = document.createElement('style')
themeStyle.textContent = themeCSS
document.head.append(themeStyle)
const effect = (fn: () => unknown) => {
  const result = fn()
  if (result && typeof result === 'object' && Symbol.iterator in result) {
    for (const _dispose of result as Iterable<unknown>) { /* 预览不触发宿主热卸载。 */ }
  }
  return result
}
const host = {
  tools: { guard: () => noop },
  commands: { register: (command: CommandDefinition) => { commands.set(command.name, command); return noop } },
  subagents: {
    getProvider: () => ({ inheritsParentContext: true, capabilities: { toolFilter: true, persona: true } }),
    start: async (_provider: string, request: { signal: AbortSignal; toolFilter: { allow: string[] }; prompt: Array<{ text: string }> }) => {
      if (request.toolFilter.allow.length !== 0) throw new Error('预览检测到工具未禁用')
      const result = new Promise<{ stopReason: string; output: Array<{ type: string; text: string }> }>(resolve => {
        const timer = setTimeout(() => {
          request.signal.removeEventListener('abort', abort)
          resolve({ stopReason: 'completed', output: [{ type: 'text', text: '每次旁问都只处理**当前问题**，回答后释放资源。\n\n主任务继续运行，旁问只使用已完成的上下文。工具白名单为空，因此不能读取新文件或执行命令。\n\n```typescript\ntoolFilter: { allow: [] }\n```\n\n[查看 DSH 文档](https://github.com/deepseek-ai/deepseek-harness)' }] })
        }, 900)
        const abort = () => { clearTimeout(timer); resolve({ stopReason: 'aborted', output: [] }) }
        request.signal.addEventListener('abort', abort, { once: true })
        if (request.signal.aborted) abort()
      })
      return { result, dispose: async () => {} }
    },
  },
  effect,
}
applyHost(host as unknown as Context)

let Source: InputTriggerSource
let Dock: React.ComponentType<Record<string, unknown>>
const sessionOf = (id: string) => ({ sessionId: id, running: false, blank: false })
const slots = {
  inject: (_key: string, fn: () => unknown) => fn(),
  register: (options: { id?: string }, component: React.ComponentType<Record<string, unknown>>) => { if (options.id === 'michengai-btw') Dock = component; return noop },
}
const remote = { commands: { execute: async (id: string, line: string, _images: unknown[], signal = new AbortController().signal) => {
  const name = line.slice(1).split(' ')[0]!
  const command = commands.get(name)
  if (!command) return { ok: true, value: undefined }
  const result = await command.handler({ commandId: 'preview', agent: { session: { header: { id } } }, rawInput: line.slice(name.length + 2), attachments: [], signal } as never)
  return { ok: true, value: { result } }
} } }
const inputTriggers = { registerSource: (source: InputTriggerSource) => { Source = source; return noop } }
const services = { slots, remote, inputTriggers, locale }
applyClient({ ...services, get: (key: keyof typeof services) => services[key], effect: (fn: () => unknown) => fn() } as unknown as Context)

function Preview(): React.JSX.Element {
  const language = useSyncExternalStore(callback => locale.subscribe(callback), () => locale.getSnapshot()).active
  const [dark, setDark] = useState(false)
  const [draft, setDraft] = useState('')
  const [session, setSession] = useState('main')
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState('')
  const submit = async () => {
    if (!draft.trim()) return
    const text = draft
    const outcome = await Source.matchEnter?.({ sessionId: session } as never, text, new AbortController().signal, { images: 0 })
    if (outcome && typeof outcome === 'object' && 'claim' in outcome) {
      const result = await outcome.claim.submit(text.slice(4).trim(), {} as Context, [])
      if (result.kind === 'error') { setError(result.text ?? '请求失败'); return }
    } else {
      setMessages(previous => [...previous, text])
    }
    setError('')
    setDraft('')
  }
  useEffect(() => { document.body.toggleAttribute('data-ds-dark-theme', dark) }, [dark])
  return <div className="preview-app">
    <aside className="preview-sidebar"><div className="preview-brand"><MessageSquare size={21} /> DSH <span>BTW</span></div><button className="preview-new" onClick={() => { setSession(session === 'main' ? 'other' : 'main'); setDraft(''); setMessages([]) }}><Plus size={16} />切换工作区</button><div className="preview-nav"><PanelLeft size={16} />项目讨论</div><p>本地预览</p></aside>
    <main className="preview-main"><header className="preview-top">{session === 'main' ? '一次性旁问' : '其他工作区'}<div className="preview-settings"><select aria-label="界面语言" value={language} onChange={event => locale.setLocale(event.target.value)}><option value="zh">中文</option><option value="en">English</option></select><label><input type="checkbox" aria-label="深色主题" checked={dark} onChange={event => setDark(event.target.checked)} />深色</label></div></header>
      <section className="preview-transcript"><div className="preview-user">我们来整理一下当前任务的实现边界。</div><div className="preview-assistant"><span className="preview-avatar"><MessageSquare size={17} /></span><div><p>本次实现包括独立旁问气泡。</p><p>先验证子代理的工具限制，再完成取消与资源释放。</p></div></div>{messages.map((message, index) => <div className="preview-user" key={index}>{message}</div>)}</section>
      <section className="preview-composer-zone">
        <Dock key={session} t={locale.bind(NS)} session={sessionOf(session)} input={{ draft, phase: 'plain', imageIds: [], occurrences: [] }} inputActions={{ setDraft }} />
        <div className="preview-composer"><textarea aria-label="消息输入框" placeholder="发送消息" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }} /><div className="preview-toolbar"><span>DeepSeek</span><button aria-label="发送消息" onClick={() => { void submit() }} disabled={!draft.trim()}><ArrowUp size={17} /></button></div></div>
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<Preview />)
