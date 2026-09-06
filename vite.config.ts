import { defineConfig } from 'vite'
import { hostThemeCSS, localeBundle } from './tests/host-client-fixtures'

export default defineConfig({
  server: { port: 5178, strictPort: true }, esbuild: { jsx: 'transform' },
  plugins: [{
    name: 'btw-host-fixtures',
    resolveId: id => id === 'virtual:btw-host' ? '\0virtual:btw-host' : undefined,
    load: id => id === '\0virtual:btw-host' ? `
      import * as React from 'react';
      import * as JSX from 'react/jsx-runtime';
      let loaded;
      const scope = { __ModuleLoader__: { load: entry => { loaded = entry.factory(name => name === 'react' ? React : name === 'react/jsx-runtime' ? JSX : {}); } } };
      ((window) => {
        ${localeBundle}
      })(scope);
      export const LocaleRuntime = loaded.LocaleRuntime;
      export const themeCSS = ${JSON.stringify(hostThemeCSS())};
    ` : undefined,
  }],
})
