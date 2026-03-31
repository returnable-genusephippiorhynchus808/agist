/**
 * Playwright Global Setup
 *
 * Creates an isolated temp DB for E2E tests.
 * The DB is seeded with demo data and cleaned up after all tests complete.
 * This prevents E2E tests from polluting the production/dev database.
 */
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const E2E_DATA_DIR = join(tmpdir(), 'agist-e2e')

export default async function globalSetup() {
  // Clean previous E2E data if exists
  if (existsSync(E2E_DATA_DIR)) {
    rmSync(E2E_DATA_DIR, { recursive: true, force: true })
  }
  mkdirSync(E2E_DATA_DIR, { recursive: true })

  // Export for use in playwright config webServer env
  process.env.AGIST_E2E_DATA_DIR = E2E_DATA_DIR
  console.log(`[E2E Setup] Temp DB dir: ${E2E_DATA_DIR}`)
}

export { E2E_DATA_DIR }
