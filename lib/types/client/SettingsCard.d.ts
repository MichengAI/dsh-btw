import React from 'react';
import { type BtwSettingsScope } from './settings-scope';
/** 卡片收到的注入面。 */
export interface BtwSettingsFace {
    scope: BtwSettingsScope;
}
/** 槽给卡片的渲染请求；`view: 'summary'` 是列表里的一行，`'page'` 才是表单。 */
interface CardProps {
    t: (key: never, params?: Record<string, string | number>) => string;
    view?: 'summary' | 'page';
    scope: BtwSettingsScope;
}
/**
 * 旁问设置卡片，同时挂在 `plugins.bundle.config`（插件页配置区）与
 * `plugins.row.config`（「包含的组件」里那一行）两个槽。
 *
 * 两个槽都会用 `view: 'summary'` 请求一行摘要、用 `'page'` 请求表单，所以这里必须先按
 * `view` 分叉：把整张表单塞进列表的一行会让整个列表被两张 textarea 撑爆。
 */
export declare function BtwSettingsCard(props: CardProps): React.JSX.Element;
export {};
