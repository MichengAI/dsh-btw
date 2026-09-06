import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 仅交换短期发布凭据以验证信任关系；不上传包，也不输出或持久化令牌。 */
export async function verifyNpmOidc({ packageName, requestUrl, requestToken, fetchImpl = fetch }) {
  if (!packageName || !requestUrl || !requestToken) throw new Error('缺少包名或 GitHub OIDC 环境，请检查 id-token: write 权限。')
  const githubUrl = new URL(requestUrl)
  githubUrl.searchParams.set('audience', 'npm:registry.npmjs.org')
  const request = async (url, options, stage) => {
    let response
    try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15_000) }) }
    catch { throw new Error(`${stage}请求失败或超时。`) }
    if (!response.ok) throw new Error(`${stage}失败：HTTP ${response.status}。`)
    try { return await response.json() }
    catch { throw new Error(`${stage}返回了无效 JSON。`) }
  }
  const identity = await request(githubUrl, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${requestToken}` },
  }, 'GitHub OIDC 身份获取')
  if (typeof identity?.value !== 'string' || !identity.value) throw new Error('GitHub 未返回 OIDC 身份令牌。')
  const authorization = await request(new URL(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`), {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${identity.value}` },
  }, 'npm 可信发布授权')
  if (typeof authorization?.token !== 'string' || !authorization.token) throw new Error('npm 未返回短期发布凭据。')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { name } = JSON.parse(readFileSync('package.json', 'utf8'))
    await verifyNpmOidc({ packageName: name, requestUrl: process.env.ACTIONS_ID_TOKEN_REQUEST_URL, requestToken: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN })
    console.log(`已通过 ${name} 的 GitHub OIDC 与 npm 授权交换验证；未上传包或修改版本。`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
