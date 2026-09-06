import { build } from 'esbuild'
import { mkdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await mkdir(new URL('../lib', import.meta.url), { recursive: true })
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' })
await build({
  entryPoints: ['src/client/index.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', external: ['react'], jsx: 'transform',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
})
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--emitDeclarationOnly', '--rootDir', 'src', '--project', 'tsconfig.build.json'], { stdio: 'inherit' })
