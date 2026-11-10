import { describe, expect, it } from 'vitest'
import { CSS } from '../src/client/styles'

describe('dsh-btw 样式与宿主 conversation.input.dock 规范对齐', () => {
  it('btw-dock 宽度必须包含 4 个 dock-inset 以对齐宿主 TodoPanel 与 QueueDock 的内嵌抽屉几何规范', () => {
    // 宿主规范几何等价性说明：
    // 1. TodoPanel: 宽度显式减去 4 个 dock-inset，内容无额外水平内边距；
    // 2. QueueDock: 宽度减去 2 个 dock-inset，外壳自带 padding: 0 dock-inset（两侧各加 1 个 inset，总计同样向内收拢 4 个 inset）。
    // 二者渲染实测内容宽度完全相同（如 680px），btw-dock 采用与 TodoPanel 相同的 4 个 dock-inset 计算公式实现像素级平齐。
    expect(CSS).toMatch(
      /\.btw-dock\{[^}]*width:calc\(100% - var\(--dsh-composer-side-clearance,0px\) - var\(--dsh-composer-side-clearance,0px\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\)\)/,
    )
    expect(CSS).toMatch(
      /\.btw-dock\{[^}]*max-width:calc\(var\(--dsh-composer-card-max-width,100%\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\) - var\(--dsh-composer-dock-inset,0px\)\)/,
    )
  })

  it('btw-bubble 必须采用宿主 specific-menu、menu-backdrop-filter、elevation-panel 与 radius-lg 规范', () => {
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*background:var\(--dsw-specific-menu\)/)
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*backdrop-filter:var\(--dsw-menu-backdrop-filter\)/)
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*box-shadow:[^}]*inset 0 0 0 \.5px var\(--dsw-elevation-stroke-color\)/)
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*--dsw-elevation-stroke-color:var\(--dsw-alias-border-l1\)/)
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*border-radius:var\(--dsw-radius-lg,12px\)/)
    expect(CSS).toMatch(/\.btw-bubble\{[^}]*border:0;/)
  })

  it('btw-header 必须采用 36px 紧凑高度，且 btw-question 必须与 line-height 保持整数倍防止长标题截断', () => {
    expect(CSS).toMatch(/\.btw-header\{[^}]*min-height:36px/)
    // line-height:24px 下，max-height 必须为 24 的整数倍（72px = 3 行），避免出现 66px 导致的第三行半截裁切
    expect(CSS).toMatch(/\.btw-question\{[^}]*line-height:24px;max-height:72px/)
  })

  it('btw-actions 按钮必须维持 28px 圆形热区规范，与宿主 dock 动作按钮语言一致', () => {
    expect(CSS).toMatch(/\.btw-actions button\{[^}]*width:28px;height:28px;[^}]*border-radius:999px/)
  })
})
