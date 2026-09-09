import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishRelease } from '../scripts/github-release.mjs'

const options = { repository: 'owner/repo', tag: 'v0.1.5', archive: './artifacts/package.tgz', notes: './artifacts/notes.md' }
const fixture = responses => {
  const calls = []
  return { calls, run: (command, args) => { calls.push([command, args]); return responses.shift() } }
}

test('查询失败时停止，不创建或更新 Release', () => {
  for (const response of [{ status: 1, stdout: '' }, { status: 1, stdout: 'v0.1.5\n' }, { status: null, error: new Error('无法启动 gh') }]) {
    const { run, calls } = fixture([response])
    assert.throws(() => publishRelease(options, run), /查询/)
    assert.equal(calls.length, 1)
  }
})

test('成功查询后仅创建不存在的版本，并校验标签', () => {
  const { run, calls } = fixture([{ status: 0, stdout: 'v0.1.4\nv0.1.50\n' }, { status: 0 }])
  publishRelease(options, run)
  assert.deepEqual(calls[0], ['gh', ['api', '--paginate', 'repos/owner/repo/releases', '--jq', '.[].tag_name']])
  assert.deepEqual(calls[1], ['gh', ['release', 'create', options.tag, options.archive, '--repo', options.repository, '--verify-tag', '--title', options.tag, '--notes-file', options.notes]])
})

test('已有版本更新说明并覆盖安装包，不重复创建', () => {
  const { run, calls } = fixture([{ status: 0, stdout: 'v0.1.4\nv0.1.5\n' }, { status: 0 }, { status: 0 }])
  publishRelease(options, run)
  assert.deepEqual(calls.slice(1).map(call => call[1][1]), ['edit', 'upload'])
  assert.ok(calls[2][1].includes('--clobber'))
})

test('预发布版本带标记；更新失败后不继续上传', () => {
  const created = fixture([{ status: 0, stdout: '' }, { status: 0 }])
  publishRelease({ ...options, tag: 'v0.1.5-rc.1' }, created.run)
  assert.ok(created.calls[1][1].includes('--prerelease'))
  const failed = fixture([{ status: 0, stdout: options.tag }, { status: 1 }])
  assert.throws(() => publishRelease(options, failed.run), /更新/)
  assert.equal(failed.calls.length, 2)
})
