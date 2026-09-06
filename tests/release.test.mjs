import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releaseNotes } from '../scripts/release-notes.mjs'

test('按版本提取双语说明，中文在前且排除其他版本', () => {
  const zh = '# 更新日志\r\n\r\n## [0.2.0]\r\n未来内容\r\n## [0.1.0] - 2026-09-06\r\n\r\n- 旁问\r\n\r\n## [0.0.1]\r\n旧内容'
  assert.equal(releaseNotes('0.1.0', 'v0.1.0', zh, '## [0.1.0]\n\n- Side questions'), '## 中文说明\n\n- 旁问\n\n---\n\n## English\n\n- Side questions\n')
})

test('拒绝错版标签、缺失语言、空章节及重复版本', () => {
  const valid = '## [0.1.0]\n- 内容'
  assert.throws(() => releaseNotes('0.1.0', 'v0.2.0', valid, valid), /版本标签/)
  assert.throws(() => releaseNotes('0.1.0', 'v0.1.0', valid, '# Changelog'), /英文/)
  assert.throws(() => releaseNotes('0.1.0', 'v0.1.0', '## [0.1.0]\n\n', valid), /不能为空/)
  assert.throws(() => releaseNotes('0.1.0', 'v0.1.0', `${valid}\n${valid}`, valid), /唯一/)
})
