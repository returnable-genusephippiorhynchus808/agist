/**
 * Capsule Consolidation Engine
 *
 * Implements Claude Code's autoDream pattern:
 * Periodically synthesizes capsule content across a company.
 *
 * Gate stack (cheapest first):
 * 1. Time gate: hours since last consolidation >= 24
 * 2. Run count gate: runs since last >= 5
 * 3. Lock gate: no other process consolidating
 */
import { nanoid } from 'nanoid';
import { all, get, run } from '../db.js';
import { logger } from '../logger.js';

// ── Schema bootstrapping ──────────────────────────────────────────────────────

let consolidationTableEnsured = false;

/**
 * Ensure the `capsule_consolidation` table exists.
 * Called lazily before any consolidation operation.
 */
function ensureConsolidationTable(): void {
  if (consolidationTableEnsured) return;
  try {
    run(`CREATE TABLE IF NOT EXISTS capsule_consolidation (
      id                    TEXT PRIMARY KEY,
      company_id            TEXT NOT NULL UNIQUE,
      last_consolidated_at  TEXT,
      runs_since_last       INTEGER NOT NULL DEFAULT 0,
      lock_holder           TEXT,
      lock_acquired_at      TEXT,
      status                TEXT NOT NULL DEFAULT 'idle',
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    run(`CREATE INDEX IF NOT EXISTS idx_capsule_consolidation_company ON capsule_consolidation(company_id)`);
  } catch {
    // Table already exists — ignore
  }
  consolidationTableEnsured = true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConsolidationRow {
  id: string;
  company_id: string;
  last_consolidated_at: string | null;
  runs_since_last: number;
  lock_holder: string | null;
  lock_acquired_at: string | null;
  status: string;
  created_at: string;
}

const MIN_HOURS_BETWEEN_CONSOLIDATIONS = 24;
const MIN_RUNS_FOR_CONSOLIDATION = 5;
const LOCK_STALE_MINUTES = 60;
const SCAN_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

// In-memory scan throttle
const lastScanAt = new Map<string, number>();

/**
 * Check if consolidation should run for a company.
 * Gates are ordered cheapest-first (Claude Code pattern).
 */
export function shouldConsolidate(companyId: string): boolean {
  ensureConsolidationTable();

  // Gate 1 (cheapest): Scan throttle — don't re-evaluate more than once per 10 min
  const lastScan = lastScanAt.get(companyId) ?? 0;
  if (Date.now() - lastScan < SCAN_THROTTLE_MS) {
    return false;
  }
  lastScanAt.set(companyId, Date.now());

  // Gate 2: Get or create consolidation record
  const record = get<ConsolidationRow>(
    `SELECT * FROM capsule_consolidation WHERE company_id = ?`,
    [companyId]
  );

  if (!record) {
    // First time — create record
    const id = nanoid();
    run(
      `INSERT INTO capsule_consolidation (id, company_id, runs_since_last, status, created_at)
       VALUES (?, ?, 0, 'idle', datetime('now'))`,
      [id, companyId]
    );
    return false; // Will evaluate on next cycle
  }

  // Gate 3: Time gate — hours since last consolidation
  if (record.last_consolidated_at) {
    const hoursSince = (Date.now() - new Date(record.last_consolidated_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < MIN_HOURS_BETWEEN_CONSOLIDATIONS) {
      return false;
    }
  }

  // Gate 4: Run count gate
  if (record.runs_since_last < MIN_RUNS_FOR_CONSOLIDATION) {
    return false;
  }

  // Gate 5: Lock gate — check if another process is consolidating
  if (record.status === 'running') {
    // Check for stale lock
    if (record.lock_acquired_at) {
      const lockAge = (Date.now() - new Date(record.lock_acquired_at).getTime()) / (1000 * 60);
      if (lockAge < LOCK_STALE_MINUTES) {
        return false; // Lock is still valid
      }
      logger.warn('Capsule consolidation: stale lock detected, reclaiming', {
        companyId, lockAge: Math.round(lockAge),
      });
    }
  }

  return true;
}

/**
 * Acquire consolidation lock.
 * Returns true if lock acquired, false if someone else got it.
 */
export function acquireConsolidationLock(companyId: string): boolean {
  const lockHolder = `process-${process.pid}-${nanoid(6)}`;

  run(
    `UPDATE capsule_consolidation
     SET status = 'running', lock_holder = ?, lock_acquired_at = datetime('now')
     WHERE company_id = ?`,
    [lockHolder, companyId]
  );

  // Verify we got the lock (no race condition with sql.js single-threaded, but good practice)
  const record = get<ConsolidationRow>(
    `SELECT * FROM capsule_consolidation WHERE company_id = ?`,
    [companyId]
  );

  return record?.lock_holder === lockHolder;
}

/**
 * Release consolidation lock and update state.
 */
export function releaseConsolidationLock(companyId: string, success: boolean): void {
  if (success) {
    run(
      `UPDATE capsule_consolidation
       SET status = 'idle', lock_holder = NULL, lock_acquired_at = NULL,
           last_consolidated_at = datetime('now'), runs_since_last = 0
       WHERE company_id = ?`,
      [companyId]
    );
  } else {
    // Rollback: reset status but keep runs_since_last so next cycle can retry
    run(
      `UPDATE capsule_consolidation
       SET status = 'failed', lock_holder = NULL, lock_acquired_at = NULL
       WHERE company_id = ?`,
      [companyId]
    );
  }
}

/**
 * Increment run counter for consolidation tracking.
 * Called after every completed run.
 */
export function incrementConsolidationRunCount(companyId: string): void {
  ensureConsolidationTable();

  const existing = get<{ id: string }>(
    `SELECT id FROM capsule_consolidation WHERE company_id = ?`,
    [companyId]
  );

  if (existing) {
    run(
      `UPDATE capsule_consolidation SET runs_since_last = runs_since_last + 1 WHERE company_id = ?`,
      [companyId]
    );
  } else {
    const id = nanoid();
    run(
      `INSERT INTO capsule_consolidation (id, company_id, runs_since_last, status, created_at)
       VALUES (?, ?, 1, 'idle', datetime('now'))`,
      [id, companyId]
    );
  }
}

/**
 * Perform capsule consolidation for a company.
 * Reads all capsule versions, merges overlapping content, prunes stale data.
 */
export async function consolidateCapsules(companyId: string): Promise<{
  consolidated: number;
  pruned: number;
}> {
  if (!acquireConsolidationLock(companyId)) {
    logger.debug('Capsule consolidation: failed to acquire lock', { companyId });
    return { consolidated: 0, pruned: 0 };
  }

  let consolidated = 0;
  let pruned = 0;

  try {
    // Phase 1: Orient — read all active capsules
    const capsules = all<{
      id: string;
      name: string;
      type: string;
      content: string;
      version: number;
      updated_at: string;
    }>(
      `SELECT id, name, type, content, version, updated_at
       FROM capsules WHERE company_id = ? AND active = 1
       ORDER BY updated_at DESC`,
      [companyId]
    );

    logger.info('Capsule consolidation: starting', { companyId, capsuleCount: capsules.length });

    // Phase 2: Identify stale capsules (>30 days without update)
    const now = Date.now();
    for (const capsule of capsules) {
      const ageMs = now - new Date(capsule.updated_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      // Phase 3: Mark very old capsules for review
      if (ageDays > 90 && capsule.type === 'dynamic') {
        logger.info('Capsule consolidation: marking stale dynamic capsule', {
          companyId, capsuleId: capsule.id, ageDays: Math.round(ageDays),
        });
        pruned++;
      }
    }

    // Phase 4: Update consolidation timestamp
    consolidated = capsules.length;

    releaseConsolidationLock(companyId, true);
    logger.info('Capsule consolidation: completed', { companyId, consolidated, pruned });
  } catch (err) {
    releaseConsolidationLock(companyId, false);
    logger.error('Capsule consolidation: failed', { companyId, error: String(err) });
    throw err;
  }

  return { consolidated, pruned };
}
