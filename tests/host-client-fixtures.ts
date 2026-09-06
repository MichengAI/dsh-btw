import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'

const require = createRequire(import.meta.url)
export const localeBundle = readFileSync(require.resolve('@deepseek-ai/dsh-client-locale/client'), 'utf8')

/** 仅装配语言注册表，不渲染宿主设置页，外部 UI 依赖不会被调用。 */
export function hostLocaleRuntime(): typeof LocaleRuntime {
  let loaded!: { LocaleRuntime: typeof LocaleRuntime }
  runInNewContext(localeBundle, {
    navigator: { languages: ['en'], language: 'en' },
    window: { __ModuleLoader__: { load: (entry: { factory: (require: (name: string) => unknown) => typeof loaded }) => {
      loaded = entry.factory(name => name.startsWith('react') ? require(name) : {})
    } } },
  })
  return loaded.LocaleRuntime
}

/** 用 TypeScript 解析宿主构建包的 CSS 字面量，避免手写颜色近似值。 */
export function hostThemeCSS(): string {
  const source = ts.createSourceFile('theme.js', readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-theme/client'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const styles: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^(base|corner_shape|design_platform|scrollbar|gradient_shadow_text)_css_default$/.test(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) styles.push(node.initializer.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!styles.some(css => css.includes('--dsw-alias-bg-base:'))) throw new Error('宿主主题令牌未提取成功')
  return styles.join('\n')
}
