import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 用最新版编译，再独立安装各版宿主运行测试，禁止旧版从开发目录借用新版宿主包。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const versions = process.argv.slice(2)
if (!versions.length) versions.push('0.1.0-rc.8', '0.1.1-rc.2', '0.1.2-rc.1', '0.1.5-rc.1')
if (versions.some(version => !['0.1.0-rc.8', '0.1.1-rc.2', '0.1.2-rc.1', '0.1.5-rc.1'].includes(version))) throw new Error('请使用指定的 DSH 候选版本')
if (!process.env.npm_execpath) throw new Error('请通过 npm run test:compat 执行')
const results = []
for (const args of [['node_modules/typescript/bin/tsc', '--noEmit'], ['scripts/build.mjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw new Error('最新版开发依赖下的类型检查或构建失败')
}

for (const version of versions) {
  const directory = join(root, '.cache', 'compatibility', version)
  mkdirSync(directory, { recursive: true })
  const log = join(directory, 'verification.log')
  writeFileSync(log, '', 'utf8')
  console.log(`\nDSH ${version}：准备独立依赖图`)
  try {
    const dependencies = Object.fromEntries(Object.entries(pkg.devDependencies)
      .filter(([name]) => !name.startsWith('@deepseek-ai/dsh-'))
      .map(([name, range]) => [name, lock.packages[`node_modules/${name}`]?.version ?? range]))
    // 内部辅助包由各版依赖图决定；新版拆出的控制器和 chat 并非旧版运行时入口。
    const splitChat = version.startsWith('0.1.0') || version.startsWith('0.1.1')
    const internal = new Set(['api-session-controller', 'subagent-in-process-driver', 'session-persistence', 'util-time'].map(name => `@deepseek-ai/dsh-${name}`))
    let pending = [...new Set([
      ...Object.keys(pkg.devDependencies).filter(name => name.startsWith('@deepseek-ai/dsh-') && !internal.has(name) && !(splitChat && name === '@deepseek-ai/dsh-client-ui-chat')),
      ...pkg.dsh.client.inject,
    ])]
    const seen = new Set()
    while (pending.length) {
      const batch = [...new Set(pending)].filter(name => !seen.has(name))
      pending = []
      for (const name of batch) seen.add(name)
      await Promise.all(batch.map(async name => {
        const response = await fetch(`https://registry.npmjs.org/${name}/${version}`, { signal: AbortSignal.timeout(30_000) })
        if (!response.ok) throw new Error(`${name}@${version}: HTTP ${response.status}`)
        const manifest = await response.json()
        dependencies[name] = version
        for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
          if (dependency.startsWith('@deepseek-ai/dsh-') && !manifest.peerDependenciesMeta?.[dependency]?.optional) pending.push(dependency)
        }
      }))
    }
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'dsh-btw-compatibility', private: true, type: 'module', dependencies }, null, 2) + '\n', 'utf8')
    for (const name of ['src', 'lib', 'tests', 'scripts', 'tsconfig.json', 'tsconfig.build.json', 'vitest.config.ts', 'cordis.patch.yml']) cpSync(join(root, name), join(directory, name), { recursive: true })
    const env = { ...process.env }
    delete env.DSH_RUNTIME_ROOT
    delete env.DSH_DESKTOP_RUNTIME_ROOT
    env.DSH_BTW_BUNDLE = '1'
    const run = (args) => {
      const result = spawnSync(process.execPath, args, { cwd: directory, env, encoding: 'utf8', timeout: 180_000, windowsHide: true })
      writeFileSync(log, `${readFileSync(log, 'utf8')}\n$ node ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8')
      if (result.error || result.status !== 0) throw new Error(result.error?.message ?? `${args[0]} 失败；详见 ${log}`)
    }
    run([process.env.npm_execpath, 'install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund'])
    for (const name of seen) {
      const installed = JSON.parse(readFileSync(join(directory, 'node_modules', name, 'package.json'), 'utf8'))
      if (installed.version !== version) throw new Error(`${name} 误装为 ${installed.version}`)
    }
    for (const name of pkg.dsh.client.inject) {
      if (!seen.has(name)) throw new Error(`客户端清单引用了未验证的宿主包：${name}`)
    }
    run(['node_modules/vitest/vitest.mjs', 'run'])
    results.push({ version, status: 'passed', hostPackages: seen.size, log })
    console.log(`DSH ${version}：功能测试通过（${seen.size} 个同版宿主包，开发编译使用最新版）`)
  } catch (error) {
    results.push({ version, status: 'failed', error: String(error), log })
    console.error(`DSH ${version}：${error}`)
  }
}
writeFileSync(join(root, '.cache', 'compatibility', 'results.json'), JSON.stringify(results, null, 2) + '\n', 'utf8')
if (results.some(result => result.status !== 'passed')) process.exitCode = 1
