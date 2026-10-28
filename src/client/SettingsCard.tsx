import React from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { MAX_PROMPT_LENGTH, MAX_TOOL_NAME_LENGTH } from '../limits'
import { clampPrompt, formatToolList, parseToolList, type BtwSettingsScope } from './settings-scope'

/** 卡片收到的注入面。 */
export interface BtwSettingsFace {
  scope: BtwSettingsScope
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * 旁问设置卡片，挂在 Plugins 页的 `plugins.row.config` 槽里（与
 * `dsh-subagent-default-model` 同一个位置）。
 *
 * 两件事都靠 `scope` 转发读写：宿主镜像回答得比 `apply()` 晚，卡片自己绑死控制器
 * 会出现「控件可用但保存全被拒」，所以绑定状态也由 scope 每帧重新给出。
 */
export function BtwSettingsCard({ t, scope }: { t: (key: never, params?: Record<string, string | number>) => string; scope: BtwSettingsScope }): React.JSX.Element {
  const snapshot = React.useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot)
  const savedTools = formatToolList(snapshot.value?.allowedTools)
  const savedPrompt = clampPrompt(snapshot.value?.promptPrefix)
  const [toolsText, setToolsText] = React.useState(savedTools)
  const [promptText, setPromptText] = React.useState(savedPrompt)
  const [state, setState] = React.useState<SaveState>('idle')
  const [error, setError] = React.useState<string | undefined>(undefined)
  // 只有宿主真的服务了本插件的命名空间，才算「读到了配置」。
  // 镜像还没回答时显示读取中，而不是先把一张空表单摆出来（那张表单写不进任何东西）。
  const loaded = scope.bound() && snapshot.status !== 'loading'

  // 镜像刷新（切页回来、别处改配置）时重置草稿：只在「已加载且值真的变了」时覆盖，
  // 否则会把用户正在输入的内容打回旧值。
  const signature = `${savedTools}\u0000${savedPrompt}`
  const lastSignature = React.useRef(signature)
  React.useEffect(() => {
    if (!loaded) return
    if (lastSignature.current === signature) return
    lastSignature.current = signature
    setToolsText(savedTools)
    setPromptText(savedPrompt)
    setState('idle')
    setError(undefined)
  }, [loaded, signature, savedTools, savedPrompt])

  const writable = snapshot.writable === true && scope.bound()
  const dirty = toolsText !== savedTools || promptText !== savedPrompt

  const save = async (): Promise<void> => {
    const tools = parseToolList(toolsText)
    if (tools === undefined) {
      setState('error')
      setError(t('settings.invalidTools' as never, { max: MAX_TOOL_NAME_LENGTH }))
      return
    }
    setState('saving')
    setError(undefined)
    try {
      const accepted = await scope.setMany([
        ['allowedTools', tools],
        ['promptPrefix', clampPrompt(promptText).slice(0, MAX_PROMPT_LENGTH)],
      ])
      if (accepted === false) {
        setState('error')
        setError(t('settings.unavailable' as never))
        return
      }
      lastSignature.current = `${tools.join('\n')}\u0000${clampPrompt(promptText)}`
      setState('saved')
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const reset = (): void => {
    setToolsText('')
    setPromptText('')
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
          className="btw-settings-textarea"
          value={promptText}
          rows={6}
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
