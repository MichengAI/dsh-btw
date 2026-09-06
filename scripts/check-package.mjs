import { execFileSync } from 'node:child_process'

const archive = process.argv[2]
if (!archive) throw new Error('用法：node scripts/check-package.mjs <安装包>')
const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
const allowed = /^(?:package\/lib\/|package\/(?:package\.json|cordis\.patch\.yml|README(?:\.zh-CN)?\.md|CHANGELOG(?:\.zh-CN)?\.md|LICENSE)$)/
if (files.some(file => !allowed.test(file) || /(?:^|\/)(?:\.env[^/]*|node_modules|artifacts|\.git|test-results)(?:\/|$)|\.(?:log|tmp|bak)$/.test(file))) {
  throw new Error('安装包包含预期范围之外的文件。')
}
for (const required of ['lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'cordis.patch.yml', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md']) {
  if (!files.includes(`package/${required}`)) throw new Error(`安装包缺少 ${required}`)
}
console.log(`安装包内容检查通过，共 ${files.length} 个文件。`)
