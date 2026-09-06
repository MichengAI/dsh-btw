import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/browser',
  use: { baseURL: 'http://127.0.0.1:5178', channel: process.env.CI ? 'chromium' : 'msedge', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
})
