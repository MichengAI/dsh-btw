// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BtwSettingsCard } from '../src/client/SettingsCard'
import {
  BUNDLE_NAME,
  ROW_CONFIG_KEY,
  clampPrompt,
  createSettingsScope,
  formatToolList,
  parseToolList,
  pickNamespace,
  type HostConfigForm,
  type HostConfigForms,
  type SettingsFormSnapshot,
} from '../src/client/settings-scope'
import { MAX_PROMPT_LENGTH } from '../src/limits'
import { translate } from '../src/locales'

/** 宿主 `configForms` 的最小替身：只实现卡片真正会碰到的那几个方法。 */
const fakeForms = (options: {
  namespaces?: readonly string[]
  snapshot?: SettingsFormSnapshot
  mutate?: (ops: readonly { op: 'set'; path: readonly string[]; value: unknown }[]) => Promise<boolean> | boolean
} = {}) => {
  const listeners = new Set<() => void>()
  const mutate = vi.fn(options.mutate ?? (async () => true))
  const controller: HostConfigForm = {
    getSnapshot: () => options.snapshot ?? { status: 'ready', writable: true, revision: 3, value: { allowedTools: ['pele_draw'], promptPrefix: '只给结论' } },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
    mutate: (ops) => Promise.resolve(mutate(ops)),
  }
  // 用可变数组模拟宿主镜像：测试可以从「还没回答」推进到「回答了某个命名空间」。
  const namespaces: string[] = [...(options.namespaces ?? [ROW_CONFIG_KEY.replace(`${BUNDLE_NAME}#`, '')])]
  const forms: HostConfigForms = {
    describe: () => ({
      getSnapshot: () => ({ status: 'ready', view: { namespaces: namespaces.map(ns => ({ ns })) } }),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) },
      load: () => Promise.resolve(),
    }),
    get: (entryId: string) => {
      if (!namespaces.includes(entryId)) throw new Error(`unknown namespace ${entryId}`)
      return controller
    },
  }
  return { forms, mutate, namespaces, emit: () => { for (const listener of listeners) listener() } }
}

/** React 给受控 textarea 装了 valueTracker，直接赋 `.value` 会被判为「没变化」而不触发 onChange。 */
const typeInto = (area: HTMLTextAreaElement, value: string): void => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
  descriptor.set!.call(area, value)
  area.dispatchEvent(new Event('input', { bubbles: true }))
}

it('行级配置 key 与参考插件同形：包名 + patch 行 id', () => {
  expect(ROW_CONFIG_KEY).toBe('@michengai/dsh-btw#michengai-btw')
})

it('只在宿主确认服务的命名空间里挑，猜不到就返回 undefined', () => {
  expect(pickNamespace(undefined)).toBeUndefined()
  expect(pickNamespace(fakeForms({ namespaces: ['subagent'] }).forms)).toBeUndefined()
  // 生产形状：真实 SettingsForms.describe() 报的就是包名本身（实测 2026-10-28）。
  // 这条是「卡片读不到配置」最容易回归的那一个，单列出来。
  expect(pickNamespace(fakeForms({ namespaces: ['@michengai/dsh-btw'] }).forms)).toBe('@michengai/dsh-btw')
  expect(pickNamespace(fakeForms({ namespaces: ['other', 'michengai-btw'] }).forms)).toBe('michengai-btw')
  expect(pickNamespace(fakeForms({ namespaces: ['include:michengai-btw'] }).forms)).toBe('include:michengai-btw')
  expect(pickNamespace(fakeForms({ namespaces: ['x/michengai-btw'] }).forms)).toBe('x/michengai-btw')
})

it('空镜像不会让 scope 假装可写；镜像回答后才绑上控制器', async () => {
  const { forms, emit, namespaces } = fakeForms({ namespaces: [] })
  const scope = createSettingsScope(forms)
  expect(scope.bound()).toBe(false)
  expect(scope.getSnapshot()).toEqual({ status: 'unavailable', writable: false })
  // 宿主镜像稍后给出命名空间：subscribe 通知后自动重绑，卡片不用重新注册。
  namespaces.push('michengai-btw')
  emit()
  expect(scope.bound()).toBe(true)
  expect(scope.getSnapshot()).toMatchObject({ status: 'ready', writable: true })
})

it('setMany 走一次原子 mutate，不逐个 set 各取一次 revision', async () => {
  const { forms, mutate } = fakeForms()
  const scope = createSettingsScope(forms)
  await expect(scope.setMany([['allowedTools', ['pele_draw']], ['promptPrefix', '只给结论']])).resolves.toBe(true)
  expect(mutate).toHaveBeenCalledOnce()
  expect(mutate).toHaveBeenCalledWith([
    { op: 'set', path: ['allowedTools'], value: ['pele_draw'] },
    { op: 'set', path: ['promptPrefix'], value: '只给结论' },
  ])
})

it('写入被宿主拒绝时把 false 原样传回，卡片据此提示只读', async () => {
  const { forms } = fakeForms({ mutate: () => false })
  const scope = createSettingsScope(forms)
  await expect(scope.setMany([['allowedTools', []]])).resolves.toBe(false)
})

it('未绑定时写入返回 undefined，绝不假装保存成功', () => {
  const scope = createSettingsScope(fakeForms({ namespaces: [] }).forms)
  return expect(scope.setMany([['allowedTools', ['pele_draw']]])).resolves.toBeUndefined()
})

it('白名单文本解析：按行去空去重，含空白或逗号视为非法', () => {
  expect(parseToolList('pele_draw\n\n  ops_bash  \npele_draw\n')).toEqual(['pele_draw', 'ops_bash'])
  expect(parseToolList('')).toEqual([])
  expect(parseToolList('pele draw')).toBeUndefined()
  expect(parseToolList('a,b')).toBeUndefined()
  expect(parseToolList('x'.repeat(121))).toBeUndefined()
})

it('已保存的白名单还原成一行一个，非法值退回空串', () => {
  expect(formatToolList(['pele_draw', 'ops_bash'])).toBe('pele_draw\nops_bash')
  expect(formatToolList(undefined)).toBe('')
  expect(formatToolList('pele_draw')).toBe('')
  expect(formatToolList([1, 'ok'])).toBe('ok')
})

it('提示词按 UTF-16 长度截断到上限', () => {
  expect(clampPrompt('x'.repeat(MAX_PROMPT_LENGTH + 10))).toHaveLength(MAX_PROMPT_LENGTH)
  expect(clampPrompt(42)).toBe('')
})

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('卡片回显已保存的白名单与提示词，保存时一次写出两个字段', async () => {
  const { forms, mutate } = fakeForms()
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))

  const textareas = [...container.querySelectorAll('textarea')]
  expect(textareas).toHaveLength(2)
  expect(textareas[0]!.value).toBe('pele_draw')
  expect(textareas[1]!.value).toBe('只给结论')

  const tools = textareas[0] as HTMLTextAreaElement
  await act(async () => { typeInto(tools, ['pele_draw', 'ops_bash'].join('\n')) })
  const save = [...container.querySelectorAll('button')].find(button => button.textContent === t('settings.save'))!
  await act(async () => save.click())
  expect(mutate).toHaveBeenCalledOnce()
  expect(mutate.mock.calls[0]![0]).toEqual([
    { op: 'set', path: ['allowedTools'], value: ['pele_draw', 'ops_bash'] },
    { op: 'set', path: ['promptPrefix'], value: '只给结论' },
  ])
  expect(container.querySelector('.btw-settings-saved')?.textContent).toBe(t('settings.saved'))
})

it('宿主不可写时两个输入框都禁用，避免给出能改的错觉', async () => {
  const { forms } = fakeForms({ snapshot: { status: 'ready', writable: false, revision: 1, value: {} } })
  const scope = createSettingsScope(forms)
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: translate('zh') as never, scope })))
  const textareas = [...container.querySelectorAll('textarea')]
  expect(textareas.every(area => area.disabled)).toBe(true)
  expect(container.querySelector('.btw-settings-warning')?.textContent).toBe(translate('zh')('settings.unavailable'))
})

// 用户要的是「打开就能改」，不是「先面对一张空白框去猜内置写了什么」。
it('没配置过提示词时输入框预填内置文案，而不是空白', async () => {
  const { forms } = fakeForms({ snapshot: { status: 'ready', writable: true, revision: 1, value: { allowedTools: [], promptPrefix: '' } } })
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))
  const prompt = container.querySelector('.btw-settings-prompt') as HTMLTextAreaElement
  expect(prompt.value).toBe(t('agent.promptPrefix'))
  expect(prompt.value.length).toBeGreaterThan(100)
  // 白名单没有「内置值」可预填，没配置过就还是空的。
  expect((container.querySelectorAll('textarea')[0] as HTMLTextAreaElement).value).toBe('')
})

it('已配置过就回显用户自己的值，不被内置文案覆盖', async () => {
  const { forms } = fakeForms({ snapshot: { status: 'ready', writable: true, revision: 1, value: { allowedTools: [], promptPrefix: '只给结论' } } })
  const scope = createSettingsScope(forms)
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: translate('zh') as never, scope })))
  expect((container.querySelector('.btw-settings-prompt') as HTMLTextAreaElement).value).toBe('只给结论')
})

it('预填的内置文案原样不动时不算改动，保存按钮保持禁用', async () => {
  const { forms } = fakeForms({ snapshot: { status: 'ready', writable: true, revision: 1, value: { allowedTools: [], promptPrefix: '' } } })
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))
  const save = [...container.querySelectorAll('button')].find(button => button.textContent === t('settings.save'))!
  expect(save.disabled).toBe(true)
})

it('把提示词改回内置原文时存空串，恢复「未配置」语义', async () => {
  const { forms, mutate } = fakeForms({ snapshot: { status: 'ready', writable: true, revision: 1, value: { allowedTools: [], promptPrefix: '只给结论' } } })
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))
  const prompt = container.querySelector('.btw-settings-prompt') as HTMLTextAreaElement
  await act(async () => { typeInto(prompt, t('agent.promptPrefix')) })
  const save = [...container.querySelectorAll('button')].find(button => button.textContent === t('settings.save'))!
  await act(async () => save.click())
  expect(mutate.mock.calls[0]![0]).toEqual([
    { op: 'set', path: ['allowedTools'], value: [] },
    { op: 'set', path: ['promptPrefix'], value: '' },
  ])
})

it('恢复默认按钮把提示词填回内置文案（不是清空），并把白名单清空', async () => {
  const { forms } = fakeForms({ snapshot: { status: 'ready', writable: true, revision: 1, value: { allowedTools: ['pele_draw'], promptPrefix: '只给结论' } } })
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))
  const reset = [...container.querySelectorAll('button')].find(button => button.textContent === t('settings.reset'))!
  await act(async () => reset.click())
  expect((container.querySelector('.btw-settings-prompt') as HTMLTextAreaElement).value).toBe(t('agent.promptPrefix'))
  expect((container.querySelectorAll('textarea')[0] as HTMLTextAreaElement).value).toBe('')
})

it('非法工具名在客户端就拦下，不发请求', async () => {
  const { forms, mutate } = fakeForms()
  const scope = createSettingsScope(forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope })))
  const tools = container.querySelectorAll('textarea')[0]!
  await act(async () => { typeInto(tools, 'pele draw') })
  const save = [...container.querySelectorAll('button')].find(button => button.textContent === t('settings.save'))!
  await act(async () => save.click())
  expect(mutate).not.toHaveBeenCalled()
  expect(container.querySelector('.btw-settings-error')?.textContent).toContain('120')
})

it('镜像未回答时卡片显示读取中，而不是空表单', async () => {
  const scope = createSettingsScope(fakeForms({ namespaces: [] }).forms)
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: translate('zh') as never, scope })))
  expect(container.querySelector('[data-btw-settings="loading"]')).not.toBeNull()
  expect(container.querySelectorAll('textarea')).toHaveLength(0)
})

// 宿主对两个槽都会先要一次 `view: 'summary'`（列表里的一行），再要 `'page'`（表单）。
// 卡片不看 view 就会把两张 textarea 塞进列表的一行，整页被撑爆——这是插件的真实渲染契约。
it('view: summary 只渲染一行摘要，不渲染表单', async () => {
  const scope = createSettingsScope(fakeForms().forms)
  const t = translate('zh')
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: t as never, scope, view: 'summary' })))
  expect(container.querySelector('.btw-settings-summary')?.textContent).toBe(t('settings.rowSummary'))
  expect(container.querySelectorAll('textarea')).toHaveLength(0)
  expect(container.querySelector('[data-btw-settings="card"]')).toBeNull()
})

it('view: page 渲染表单', async () => {
  const scope = createSettingsScope(fakeForms().forms)
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: translate('zh') as never, scope, view: 'page' })))
  expect(container.querySelector('[data-btw-settings="card"]')).not.toBeNull()
  expect(container.querySelectorAll('textarea')).toHaveLength(2)
  expect(container.querySelector('.btw-settings-summary')).toBeNull()
})

it('不给 view 时按表单渲染（宿主省略 view 的老契约）', async () => {
  const scope = createSettingsScope(fakeForms().forms)
  await act(async () => root.render(React.createElement(BtwSettingsCard, { t: translate('zh') as never, scope })))
  expect(container.querySelector('[data-btw-settings="card"]')).not.toBeNull()
})
