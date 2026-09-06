import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('满二十条时关闭最旧气泡后继续提问，输入和布局正常', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/')
  const input = page.getByRole('textbox')
  for (let index = 0; index < 21; index++) {
    await input.fill(`/btw 问题 ${index}`)
    await input.press('Enter')
    await expect(input).toHaveValue('')
    await expect(page.locator('.btw-answer').last()).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(Math.min(index + 1, 20))
    await expect(page.locator('.btw-status')).toHaveCount(0)
  }
  await expect(page.locator('.btw-question').first()).toHaveText('问题 1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const dock = await page.locator('.btw-dock').boundingBox()
  const composer = await input.boundingBox()
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(composer!.y)
  await page.screenshot({ path: `artifacts/btw-capacity-${testInfo.project.name}.png`, fullPage: true })
})

for (const systemTheme of ['light', 'dark'] as const) {
  test(`宿主主题优先于系统 ${systemTheme} 偏好，浅深色对比度合格`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ colorScheme: systemTheme })
    await page.goto('/')
    await page.getByRole('textbox').fill('/btw Theme contrast')
    await page.getByRole('textbox').press('Enter')
    await expect(page.locator('.btw-answer')).toBeVisible()
    for (const dark of [false, true]) {
      await page.getByRole('checkbox', { name: '深色主题' }).setChecked(dark)
      const colors = await page.locator('.btw-bubble').evaluate(element => {
        const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const luminance = (color: string) => rgb(color).reduce((sum, value, index) => {
          const linear = value / 255
          return sum + (linear <= .04045 ? linear / 12.92 : ((linear + .055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]!
        }, 0)
        const style = getComputedStyle(element)
        const background = luminance(style.backgroundColor)
        const contrast = (color: string) => (Math.max(luminance(color), background) + .05) / (Math.min(luminance(color), background) + .05)
        return {
          background,
          primary: contrast(style.color),
          secondary: contrast(getComputedStyle(element.querySelector('.btw-actions button')!).color),
          link: contrast(getComputedStyle(element.querySelector('.btw-answer a')!).color),
          noAccent: style.borderLeftColor === style.borderRightColor,
          composer: getComputedStyle(document.querySelector('.preview-composer')!).backgroundColor === style.backgroundColor,
        }
      })
      expect(colors.primary).toBeGreaterThanOrEqual(4.5)
      expect(colors.secondary).toBeGreaterThanOrEqual(4.5)
      expect(colors.link).toBeGreaterThanOrEqual(4.5)
      expect(colors.background > .5).toBe(!dark)
      expect(colors.noAccent && colors.composer).toBe(true)
      await page.screenshot({ path: `artifacts/btw-theme-${dark ? 'dark' : 'light'}-${testInfo.project.name}.png`, fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test('宿主语言即时更新气泡和错误，保留回答原文', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en')
  await page.getByRole('textbox').fill('/btw 语言检查')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByRole('status')).toHaveText('Answering…')
  await expect(page.getByRole('article', { name: 'Side question answer' })).toBeVisible()
  await expect(page.locator('.btw-answer')).toBeVisible()
  const answer = await page.locator('.btw-answer').innerText()
  await page.getByRole('button', { name: 'Collapse answer' }).click()
  await expect(page.getByRole('button', { name: 'Expand answer' })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('zh')
  await page.getByRole('button', { name: '展开回答' }).click()
  expect(await page.locator('.btw-answer').innerText()).toBe(answer)
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en')
  await page.screenshot({ path: `artifacts/btw-english-${testInfo.project.name}.png`, fullPage: true })
  await page.getByRole('textbox').fill('/btw ')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Enter a side question.')
  await page.getByRole('button', { name: 'Close side question' }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('气泡遵循宿主输入区域的宽度和水平位置', async ({ page }) => {
  await page.goto('/')
  await page.addStyleTag({ content: '.preview-composer-zone{width:100%;max-width:none;padding-inline:0;--dsh-composer-card-max-width:620px;--dsh-composer-side-clearance:16px}.preview-composer{width:calc(100% - 32px);max-width:620px;margin-inline:auto}' })
  await page.getByRole('textbox').fill('/btw 宽度检查')
  await page.getByRole('textbox').press('Enter')
  const dock = page.locator('.btw-dock')
  await dock.waitFor()
  const actual = await dock.boundingBox()
  const composer = await page.locator('.preview-composer').boundingBox()
  expect(Math.abs(actual!.width - composer!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual!.x - composer!.x)).toBeLessThanOrEqual(1)
})

test('构建包可被宿主模块加载器装配', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.addScriptTag({ path: 'node_modules/react/umd/react.production.min.js' })
  await page.addScriptTag({ content: `(function(require,exports){${readFileSync('node_modules/react/cjs/react-jsx-runtime.production.min.js', 'utf8')}\n})(()=>window.React,window.ReactJSX={});` })
  await page.evaluate(() => {
    const host = window as unknown as { React: unknown; ReactJSX: unknown; __ModuleLoader__: unknown; btwExports: unknown }
    host.__ModuleLoader__ = { load: (entry: { id: string; factory: (require: (name: string) => unknown) => { apply: unknown; inject: string[] } }) => {
      const exports = entry.factory(name => {
        if (name === 'react') return host.React
        if (name === 'react/jsx-runtime') return host.ReactJSX
        throw new Error(`意外外部依赖：${name}`)
      })
      host.btwExports = { id: entry.id, applyType: typeof exports.apply, inject: exports.inject }
    } }
  })
  await page.addScriptTag({ path: 'lib/client.js' })
  expect(errors).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { btwExports: unknown }).btwExports)).toEqual({
    id: '@michengai/dsh-btw', applyType: 'function', inject: ['slots', 'inputTriggers', 'remote', 'remote.commands', 'locale'],
  })
})

test('独立气泡、折叠、关闭与布局', async ({ page }, testInfo) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '消息输入框' })
  await input.fill('/btw 为什么每次旁问都创建一次性子代理？')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  const bubble = page.getByRole('article', { name: '旁问回答' })
  await expect(bubble).toContainText('正在回答')
  await expect(bubble).toContainText('白名单为空')
  await expect(bubble.locator('pre')).toBeVisible()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: '复制回答' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('当前问题')
  await page.screenshot({ path: `artifacts/btw-${testInfo.project.name}.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const bubbleBox = await bubble.boundingBox()
  const inputBox = await input.boundingBox()
  expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(inputBox!.y)
  await page.getByRole('button', { name: '折叠回答' }).click()
  await expect(bubble.locator('pre')).toBeHidden()
  await page.getByRole('button', { name: '展开回答' }).click()
  await page.getByRole('button', { name: '关闭旁问' }).click()
  await expect(bubble).toHaveCount(0)
})

test('取消后迟到答案不会出现', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox').fill('/btw 取消这次问题')
  await page.getByRole('button', { name: '发送消息' }).click()
  await page.getByRole('button', { name: '关闭旁问' }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.waitForTimeout(1200)
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('BTW 不拦截上下键或写入输入历史', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox')
  await input.fill('/btw 旁问测试')
  await input.press('Enter')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('')
  await input.fill('没有发送的草稿')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('没有发送的草稿')
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('history')))).toEqual([])
})

test('工作区切换隔离气泡', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', '预览窄屏不展示工作区切换按钮')
  await page.goto('/')
  const input = page.getByRole('textbox')
  await input.fill('/btw 工作区一的问题')
  await input.press('Enter')
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('button', { name: '切换工作区' }).click()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('button', { name: '切换工作区' }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
})
