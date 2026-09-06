import { expect, it } from 'vitest'
import { parseRequest } from '../src/shared'
import { SideJobs } from '../src/server/jobs'

it('请求保留界面语言，兼容未传语言的旧客户端', () => {
  expect(parseRequest('{"id":"request01","question":"你好","locale":"en"}')).toMatchObject({ locale: 'en' })
  expect(parseRequest('{"id":"request01","question":"你好"}')).toMatchObject({ locale: 'zh' })
})

it('英文界面的空回答与重复提交提示使用英文', async () => {
  const jobs = new SideJobs(async () => ({ result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose: async () => {} }))
  expect((await jobs.ask('session', 'request01', '你好', undefined, undefined, 'en')).text).toBe('The model returned no text.')
  expect((await jobs.ask('session', 'request01', '你好', undefined, undefined, 'en')).text).toBe('This side question was already submitted or closed.')
})

it('英文界面不会改写中文模型回答', async () => {
  const jobs = new SideJobs(async () => ({ result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '原始回答' }] }), dispose: async () => {} }))
  expect((await jobs.ask('session', 'request02', '你好', undefined, undefined, 'en')).text).toBe('原始回答')
})
