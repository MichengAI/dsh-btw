import { describe, expect, it } from 'vitest'
import semver from 'semver'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadPluginManifest() {
  let pkgPath = resolve(__dirname, '../package.json')
  let pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (!pkg.engines?.dsh) {
    // 处于 test:compat 隔离子目录 (.cache/compatibility/<version>) 中
    const rootPkgPath = resolve(__dirname, '../../../../package.json')
    if (existsSync(rootPkgPath)) {
      pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
    }
  }
  return pkg
}

const pkg = loadPluginManifest()

describe('DSH 宿主准入范围契约 (engines.dsh)', () => {
  it('声明了正确的 engines.dsh 代际范围，上界必须排除 0.3.0 的所有预发布版本', () => {
    expect(pkg.engines?.dsh).toBe('>=0.2.0-rc.1 <0.3.0-0')
  })

  it('按 DSH 官方宿主版本门规则 (includePrerelease: true) 正确放行与拦截', () => {
    const range = pkg.engines.dsh
    const check = (version: string) => semver.satisfies(version, range, { includePrerelease: true })

    // 低于最低保留基线的旧版本必须被拦截
    expect(check('0.1.7-rc.2')).toBe(false)
    expect(check('0.2.0-alpha.1')).toBe(false)

    // 0.2.0 起的已验证版本必须放行
    expect(check('0.2.0-rc.1')).toBe(true)
    expect(check('0.2.0-rc.2')).toBe(true)
    expect(check('0.2.1-rc.1')).toBe(true)
    expect(check('0.2.1-rc.2')).toBe(true)
    expect(check('0.2.1-rc.3')).toBe(true)

    // 0.2.x 代际内未来的补丁、RC 与频繁的 alpha 版本均自动放行，无需发版
    expect(check('0.2.1-rc.4')).toBe(true)
    expect(check('0.2.2-alpha.1')).toBe(true)
    expect(check('0.2.2-alpha.2')).toBe(true)
    expect(check('0.2.2-rc.1')).toBe(true)
    expect(check('0.2.9')).toBe(true)

    // 0.3.0 的破坏性更新（包括其 alpha、rc 和正式版）必须被坚决拦截
    expect(check('0.3.0-alpha.1')).toBe(false)
    expect(check('0.3.0-rc.1')).toBe(false)
    expect(check('0.3.0')).toBe(false)
    expect(check('1.0.0')).toBe(false)
  })

  it('peerDependencies 中的 @deepseek-ai/dsh-* 范围与 engines.dsh 保持一致', () => {
    const dshPeers = Object.entries(pkg.peerDependencies || {}).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    expect(dshPeers.length).toBeGreaterThan(0)
    for (const [name, range] of dshPeers) {
      expect(range, `${name} peer range 必须对齐代际范围`).toBe('>=0.2.0-rc.1 <0.3.0-0')
    }
  })
})
