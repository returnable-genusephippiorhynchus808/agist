/**
 * Playwright Global Teardown
 *
 * Removes the temp E2E database directory after all tests complete.
 */
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const E2E_DATA_DIR = join(tmpdir(), 'agist-e2e')

export default async function globalTeardown() {
  if (existsSync(E2E_DATA_DIR)) {
    rmSync(E2E_DATA_DIR, { recursive: true, force: true })
    console.log(`[E2E Teardown] Cleaned up: ${E2E_DATA_DIR}`)
  }
}
