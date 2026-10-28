import React from 'react';
import { type BtwSettingsScope } from './settings-scope';
/** 卡片收到的注入面。 */
export interface BtwSettingsFace {
    scope: BtwSettingsScope;
}
/**
 * 旁问设置卡片，挂在 Plugins 页的 `plugins.row.config` 槽里（与
 * `dsh-subagent-default-model` 同一个位置）。
 *
 * 两件事都靠 `scope` 转发读写：宿主镜像回答得比 `apply()` 晚，卡片自己绑死控制器
 * 会出现「控件可用但保存全被拒」，所以绑定状态也由 scope 每帧重新给出。
 */
export declare function BtwSettingsCard({ t, scope }: {
    t: (key: never, params?: Record<string, string | number>) => string;
    scope: BtwSettingsScope;
}): React.JSX.Element;
