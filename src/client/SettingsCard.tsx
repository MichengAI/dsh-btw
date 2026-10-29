import React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { MAX_PROMPT_LENGTH, MAX_TOOL_NAME_LENGTH } from '../limits'
import { clampPrompt, formatToolList, parseToolList, type BtwSettingsScope } from './settings-scope'

/** 卡片收到的注入面。 */
export interface BtwSettingsFace {
  scope: BtwSettingsScope
}

/** 槽给卡片的渲染请求；`view: 'summary'` 是列表里的一行，`'page'` 才是表单。 */
interface CardProps {
  t: (key: never, params?: Record<string, string | number>) => string
  view?: 'summary' | 'page'
  scope: BtwSettingsScope
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * 旁问设置卡片，同时挂在 `plugins.bundle.config`（插件页配置区）与
 * `plugins.row.config`（「包含的组件」里那一行）两个槽。
 *
 * 两个槽都会用 `view: 'summary'` 请求一行摘要、用 `'page'` 请求表单，所以这里必须先按
 * `view` 分叉：把整张表单塞进列表的一行会让整个列表被两张 textarea 撑爆。
 */
export function BtwSettingsCard(props: CardProps): React.JSX.Element {
  const { t, scope, view } = props
  return view === 'summary' ? <Summary t={t} /> : <SettingsForm t={t} scope={scope} />
}

/** 列表里的一行：只有一句说明，与同列表的其它插件行等高。 */
function Summary({ t }: { t: CardProps['t'] }): React.JSX.Element {
  return <p className="btw-settings-summary">{t('settings.rowSummary' as never)}</p>
}

function SettingsForm({ t, scope }: { t: CardProps['t']; scope: BtwSettingsScope }): React.JSX.Element {
  const snapshot = React.useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot)
  const savedTools = formatToolList(snapshot.value?.allowedTools)
  const savedPrompt = clampPrompt(snapshot.value?.promptPrefix)
  // 内置提示词就是「未配置」时真正生效的那段文案。输入框以它为起点，用户才能直接在上面改，
  // 而不是对着一张空白框去猜内置写了什么。
  const builtInPrompt = t('agent.promptPrefix' as never)
  // 已保存的值优先；没保存过就把内置文案摆出来。`savedPrompt` 本身仍保持空，用来判断「是否配置过」。
  const editablePrompt = savedPrompt === '' ? builtInPrompt : savedPrompt
  const [toolsText, setToolsText] = React.useState(savedTools)
  const [promptText, setPromptText] = React.useState(editablePrompt)
  const [state, setState] = React.useState<SaveState>('idle')
  const [error, setError] = React.useState<string | undefined>(undefined)
  // 只有宿主真的服务了本插件的命名空间，才算「读到了配置」。
  // 镜像还没回答时显示读取中，而不是先把一张空表单摆出来（那张表单写不进任何东西）。
  const loaded = scope.bound() && snapshot.status !== 'loading'

  // 镜像刷新（切页回来、别处改配置）时重置草稿：只在「已加载且值真的变了」时覆盖，
  // 否则会把用户正在输入的内容打回旧值。
  const signature = `${savedTools}\u0000${editablePrompt}`
  const lastSignature = React.useRef(signature)
  React.useEffect(() => {
    if (!loaded) return
    if (lastSignature.current === signature) return
    lastSignature.current = signature
    setToolsText(savedTools)
    setPromptText(editablePrompt)
    setState('idle')
    setError(undefined)
  }, [loaded, signature, savedTools, editablePrompt])

  const writable = snapshot.writable === true && scope.bound()
  // 与「当前起点的文案」比，不是与已保存值比：内置文案预填后原样不动，不该算改动。
  const dirty = toolsText !== savedTools || promptText !== editablePrompt

  const save = async (): Promise<void> => {
    const tools = parseToolList(toolsText)
    if (tools === undefined) {
      setState('error')
      setError(t('settings.invalidTools' as never, { max: MAX_TOOL_NAME_LENGTH }))
      return
    }
    setState('saving')
    setError(undefined)
    const prompt = clampPrompt(promptText).slice(0, MAX_PROMPT_LENGTH)
    // 与内置文案一致就存空串：这样它仍然算「未配置」，插件升级改了内置文案时能顺带跟上，
    // 而不是把一份旧快照永久钉在用户配置里。
    const stored = prompt.trim() === builtInPrompt.trim() ? '' : prompt
    try {
      const accepted = await scope.setMany([
        ['allowedTools', tools],
        ['promptPrefix', stored],
      ])
      if (accepted === false) {
        setState('error')
        setError(t('settings.unavailable' as never))
        return
      }
      lastSignature.current = `${tools.join('\n')}\u0000${stored === '' ? builtInPrompt : stored}`
      setState('saved')
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const reset = (): void => {
    setToolsText('')
    setPromptText(builtInPrompt)
    setState('idle')
    setError(undefined)
  }

  if (!loaded) {
    return <div className="btw-settings" data-btw-settings="loading">{t('settings.loading' as never)}</div>
  }

  return (
    <div className="btw-settings" data-btw-settings="card">
      <h3 className="btw-settings-title">{t('settings.title' as never)}</h3>
      <p className="btw-settings-description">{t('settings.description' as never)}</p>
      {!writable && <p className="btw-settings-warning" role="status">{t('settings.unavailable' as never)}</p>}
      <label className="btw-settings-field">
        <span className="btw-settings-label">{t('settings.allowedToolsLabel' as never)}</span>
        <textarea
          className="btw-settings-textarea"
          value={toolsText}
          rows={4}
          spellCheck={false}
          placeholder={t('settings.allowedToolsPlaceholder' as never)}
          disabled={!writable}
          onChange={event => { setToolsText(event.target.value); setState('idle'); setError(undefined) }}
        />
        <span className="btw-settings-hint">{t('settings.allowedToolsHint' as never)}</span>
      </label>
      <label className="btw-settings-field">
        <span className="btw-settings-label">{t('settings.promptLabel' as never)}</span>
        <textarea
          className="btw-settings-textarea btw-settings-prompt"
          value={promptText}
          rows={10}
          spellCheck={false}
          placeholder={t('settings.promptPlaceholder' as never)}
          disabled={!writable}
          onChange={event => { setPromptText(event.target.value); setState('idle'); setError(undefined) }}
        />
        <span className="btw-settings-hint">{t('settings.promptHint' as never)}</span>
      </label>
      {error !== undefined && <p className="btw-settings-error" role="alert">{error}</p>}
      <div className="btw-settings-actions">
        <Button variant="primary" disabled={!writable || !dirty || state === 'saving'} onClick={() => void save()}>{t(state === 'saving' ? 'settings.saving' as never : 'settings.save' as never)}</Button>
        <Button disabled={!writable || (!dirty && savedTools === '' && savedPrompt === '')} onClick={reset}>{t('settings.reset' as never)}</Button>
        {state === 'saved' && <span className="btw-settings-saved" role="status">{t('settings.saved' as never)}</span>}
      </div>
    </div>
  )
}
