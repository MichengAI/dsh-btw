import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyNpmOidc } from '../scripts/verify-npm-oidc.mjs'

const options = { packageName: '@michengai/dsh-btw', requestUrl: 'https://example.test/oidc?request=1', requestToken: 'test-request-token' }
const response = body => ({ ok: true, json: async () => body })

test('只获取 GitHub 身份并交换 npm 凭据，不执行发布或返回令牌', async () => {
  const calls = []
  const result = await verifyNpmOidc({ ...options, fetchImpl: async (url, init) => {
    calls.push({ url: new URL(url), init })
    return response(calls.length === 1 ? { value: 'test-identity' } : { token: 'test-publish-token' })
  } })
  assert.equal(result, undefined)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url.searchParams.get('audience'), 'npm:registry.npmjs.org')
  assert.equal(calls[0].url.searchParams.get('request'), '1')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-request-token')
  assert.equal(calls[1].url.origin, 'https://registry.npmjs.org')
  assert.equal(decodeURIComponent(calls[1].url.pathname), '/-/npm/v1/oidc/token/exchange/package/@michengai/dsh-btw')
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-identity')
  assert.ok(calls.every(call => call.init.signal instanceof AbortSignal))
})

test('缺少 GitHub 环境时不发送请求', async () => {
  await assert.rejects(verifyNpmOidc({ ...options, requestToken: undefined, fetchImpl: () => assert.fail('不应发起请求') }), /id-token: write/)
})

test('GitHub 身份获取失败后不继续交换凭据', async () => {
  let calls = 0
  await assert.rejects(verifyNpmOidc({ ...options, fetchImpl: async () => {
    calls++
    return { ok: false, status: 403 }
  } }), /GitHub.*HTTP 403/)
  assert.equal(calls, 1)
})

test('npm 拒绝授权时失败，错误正文不进入日志', async () => {
  let calls = 0
  await assert.rejects(verifyNpmOidc({ ...options, fetchImpl: async () => ++calls === 1
    ? response({ value: 'test-identity' })
    : { ok: false, status: 401, json: () => assert.fail('不应读取错误正文') },
  }), /npm.*HTTP 401/)
})

test('令牌缺失或网络异常不被当作验证成功，也不泄露底层错误', async () => {
  for (const bodies of [[{}, { token: 'unused' }], [{ value: 'test-identity' }, {}], [null], [{ value: 'test-identity' }, null]]) {
    await assert.rejects(verifyNpmOidc({ ...options, fetchImpl: async () => response(bodies.shift()) }), /未返回/)
  }
  await assert.rejects(verifyNpmOidc({ ...options, fetchImpl: async () => { throw new Error('sensitive test detail') } }), { message: 'GitHub OIDC 身份获取请求失败或超时。' })
  await assert.rejects(verifyNpmOidc({ ...options, fetchImpl: async () => ({ ok: true, json: () => { throw new Error('sensitive test detail') } }) }), { message: 'GitHub OIDC 身份获取返回了无效 JSON。' })
})
