import { defineConfig } from '@playwright/test'
import { join } from 'path'
import { tmpdir } from 'os'

const E2E_DATA_DIR = join(tmpdir(), 'agist-e2e')

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
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
      env: {
        AGIST_AUTH_DISABLED: 'true',
        AGIST_DATA_DIR: E2E_DATA_DIR,
        PORT: '4401',
        CORS_ORIGINS: 'http://localhost:3003',
      },
    },
    {
      command: 'pnpm --filter @agist/web exec next dev -p 3003',
      port: 3003,
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:4401/api',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:4401/ws',
      },
    },
  ],
})
