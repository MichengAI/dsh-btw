import { describe, expect, it } from 'vitest'
import { parseRequest } from '../src/shared'
import { SideJobs } from '../src/server/jobs'
import { zh, en, ja, es, fr, de, ru, pt, LOCALE_DICTIONARIES, translate, normalizeLocale, type BtwLocale } from '../src/locales'
import fs from 'node:fs'
import path from 'node:path'

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

describe('全量 8 门官方语言支持与一致性断言', () => {
  const allLocales: Record<BtwLocale, Record<string, string>> = {
    zh,
    en,
    ja,
    es,
    fr,
    de,
    ru,
    pt,
  }

  const expectedKeyCount = 85
  const zhKeys = Object.keys(zh).sort()

  it(`中文基线字典恰好包含 ${expectedKeyCount} 个键`, () => {
    expect(zhKeys).toHaveLength(expectedKeyCount)
  })

  it('LOCALE_DICTIONARIES 常量导出并精确覆盖全部 8 门语言', () => {
    const dictKeys = Object.keys(LOCALE_DICTIONARIES).sort()
    expect(dictKeys).toEqual(['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'])
  })

  it('客户端 apply 注册哨兵：源码必须直接注册 LOCALE_DICTIONARIES，杜绝两语回退', () => {
    let rootDir = process.cwd()
    let curr = path.resolve(__dirname, '..')
    while (curr && curr !== path.dirname(curr)) {
      if (fs.existsSync(path.join(curr, '.git')) && fs.existsSync(path.join(curr, 'package.json'))) {
        rootDir = curr
        break
      }
      curr = path.dirname(curr)
    }
    const clientSource = fs.readFileSync(path.resolve(rootDir, 'src/client/index.tsx'), 'utf8')
    expect(clientSource).toContain('ctx.locale.register(NS, LOCALE_DICTIONARIES)')
  })

  it('所有 8 门语言具有完全相同的键集合，零遗漏、零多余', () => {
    for (const [lang, dict] of Object.entries(allLocales)) {
      const keys = Object.keys(dict).sort()
      expect(keys, `语言 ${lang} 键集合必须与 zh 完全一致`).toEqual(zhKeys)
    }
  })

  it('各语言 locale.id 正确自指向', () => {
    for (const [lang, dict] of Object.entries(allLocales)) {
      expect(dict['locale.id']).toBe(lang)
    }
  })

  it('参数插值占位符在所有语言中均正确保留', () => {
    for (const lang of Object.keys(allLocales) as BtwLocale[]) {
      const t = translate(lang)
      expect(t('settings.invalidTools', { max: 120 })).toContain('120')
      expect(t('agent.toolsAllowed', { tools: 'pele_draw' })).toContain('pele_draw')
      expect(t('agent.replyHint', { field: 'agent', parent: 'sess-123' })).toContain('agent')
      expect(t('agent.replyHint', { field: 'agent', parent: 'sess-123' })).toContain('sess-123')
      expect(t('agent.replyHint', { field: 'agent_id', parent: 'sess-123' })).toContain('agent_id')
      expect(t('agent.promptPrefix')).not.toContain('agent_id')
    }
  })

  it('normalizeLocale 能正确识别 8 种语言及其区域前缀，未知回退到 en', () => {
    expect(normalizeLocale(undefined)).toBe('zh')
    expect(normalizeLocale(null)).toBe('zh')
    expect(normalizeLocale('zh')).toBe('zh')
    expect(normalizeLocale('zh-CN')).toBe('zh')
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('ja')).toBe('ja')
    expect(normalizeLocale('ja-JP')).toBe('ja')
    expect(normalizeLocale('es')).toBe('es')
    expect(normalizeLocale('es-ES')).toBe('es')
    expect(normalizeLocale('fr')).toBe('fr')
    expect(normalizeLocale('fr-FR')).toBe('fr')
    expect(normalizeLocale('de')).toBe('de')
    expect(normalizeLocale('de-DE')).toBe('de')
    expect(normalizeLocale('ru')).toBe('ru')
    expect(normalizeLocale('ru-RU')).toBe('ru')
    expect(normalizeLocale('pt')).toBe('pt')
    expect(normalizeLocale('pt-BR')).toBe('pt')
    expect(normalizeLocale('ko')).toBe('en')
    expect(normalizeLocale('it')).toBe('en')
  })

  it('locale/*.json 全部 8 个元数据文件均存在且格式规范', () => {
    let rootDir = process.cwd()
    let curr = path.resolve(__dirname, '..')
    while (curr && curr !== path.dirname(curr)) {
      if (fs.existsSync(path.join(curr, '.git')) && fs.existsSync(path.join(curr, 'package.json'))) {
        rootDir = curr
        break
      }
      curr = path.dirname(curr)
    }

    const langs: BtwLocale[] = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt']
    for (const lang of langs) {
      const jsonPath = path.resolve(rootDir, 'locale', `${lang}.json`)
      expect(fs.existsSync(jsonPath), `locale/${lang}.json 必须存在`).toBe(true)
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      expect(data.meta).toBeDefined()
      expect(data.meta.title).toBe('BTW')
      expect(typeof data.meta.description).toBe('string')
      expect(data.meta.description.length).toBeGreaterThan(0)
      const expectedDetail = lang === 'zh' ? 'README.zh-CN.md' : `README.${lang}.md`
      expect(data.meta.detail).toBe(expectedDetail)
      expect(fs.existsSync(path.resolve(rootDir, data.meta.detail)), `${data.meta.detail} 文件必须存在`).toBe(true)
    }
  })
})
