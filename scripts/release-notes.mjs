import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 校验标签并从两份更新日志提取同一版本；任一语言缺失时拒绝发布。 */
export function releaseNotes(version, tag, chinese, english) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) || tag !== `v${version}`) {
    throw new Error('版本标签必须与 package.json 一致。')
  }
  const section = (source, language) => {
    const lines = source.split(/\r?\n/)
    const matches = lines.flatMap((line, index) => line.match(/^## \[([^\]]+)\]/)?.[1] === version ? [index] : [])
    if (matches.length !== 1) throw new Error(`${language}更新日志必须包含唯一的 ${version} 章节。`)
    const start = matches[0] + 1
    const next = lines.findIndex((line, index) => index >= start && line.startsWith('## '))
    const body = lines.slice(start, next < 0 ? undefined : next).join('\n').trim()
    if (!body) throw new Error(`${language}更新日志不能为空。`)
    return body
  }
  return `## 中文说明\n\n${section(chinese, '中文')}\n\n---\n\n## English\n\n${section(english, '英文')}\n`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , tag, output] = process.argv
  if (!tag || !output) throw new Error('用法：node scripts/release-notes.mjs <版本标签> <输出文件>')
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
  const notes = releaseNotes(version, tag, readFileSync('CHANGELOG.zh-CN.md', 'utf8'), readFileSync('CHANGELOG.md', 'utf8'))
  writeFileSync(output, notes, 'utf8')
  console.log(`已生成 ${tag} 中英双语说明。`)
}
