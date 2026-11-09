import { execFileSync } from 'node:child_process'

const archive = process.argv[2]
if (!archive) throw new Error('用法：node scripts/check-package.mjs <安装包>')
const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
const allowed = /^(?:package\/lib\/|package\/assets\/icon\.svg$|package\/locale\/[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*\.json$|package\/(?:package\.json|cordis\.patch\.yml|README(?:\.[A-Za-z-]+)?\.md|CHANGELOG(?:\.zh-CN)?\.md|LICENSE)$)/
if (files.some(file => !allowed.test(file) || /(?:^|\/)(?:\.env[^/]*|node_modules|artifacts|\.git|test-results)(?:\/|$)|\.(?:log|tmp|bak)$/.test(file))) {
  throw new Error('安装包包含预期范围之外的文件。')
}
for (const required of [
  'lib/index.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'cordis.patch.yml',
  'README.md',
  'README.zh-CN.md',
  'README.en.md',
  'README.ja.md',
  'README.es.md',
  'README.fr.md',
  'README.de.md',
  'README.ru.md',
  'README.pt.md',
  'CHANGELOG.md',
  'CHANGELOG.zh-CN.md',
  'locale/zh.json',
  'locale/en.json',
  'locale/ja.json',
  'locale/es.json',
  'locale/fr.json',
  'locale/de.json',
  'locale/ru.json',
  'locale/pt.json',
  'assets/icon.svg',
]) {
  if (!files.includes(`package/${required}`)) throw new Error(`安装包缺少 ${required}`)
}
console.log(`安装包内容检查通过，共 ${files.length} 个文件。`)
