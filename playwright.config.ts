import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @agist/server exec tsx src/index.ts',
      port: 4401,
      reuseExistingServer: true,
      timeout: 15000,
      env: { AGIST_AUTH_DISABLED: 'true', AGIST_DATA_DIR: '' },
    },
    {
      command: 'pnpm --filter @agist/web exec next dev -p 3003',
      port: 3003,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
})
