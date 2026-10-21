import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': path.resolve(__dirname, 'tests/mock-primitives.tsx'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
