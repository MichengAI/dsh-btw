import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 完整查询成功后才决定创建或更新；任何失败都停止后续写入。 */
export function publishRelease({ repository, tag, notes }, run = spawnSync) {
  if (!repository || !tag || !notes) throw new Error('缺少 Release 仓库、标签或说明路径。')
  const invoke = (args, action) => {
    const result = run('gh', args, { encoding: 'utf8' })
    if (result.error || result.status !== 0) throw new Error(`GitHub Release ${action}失败，请检查 gh 认证、网络和仓库权限。`)
    return result.stdout ?? ''
  }
  // 分页列表避免把单版本查询的网络、权限等错误误判为版本不存在。
  const tags = invoke(['api', '--paginate', `repos/${repository}/releases`, '--jq', '.[].tag_name'], '查询').split(/\r?\n/)
  const metadata = ['--repo', repository, '--title', tag, '--notes-file', notes]
  if (tags.includes(tag)) {
    invoke(['release', 'edit', tag, ...metadata], '更新说明')
  } else {
    invoke(['release', 'create', tag, '--repo', repository, '--verify-tag', '--title', tag, '--notes-file', notes, ...(tag.includes('-') ? ['--prerelease'] : [])], '创建')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  publishRelease({ repository: process.env.GITHUB_REPOSITORY, tag: process.env.RELEASE_TAG, notes: './artifacts/release-notes.md' })
}
