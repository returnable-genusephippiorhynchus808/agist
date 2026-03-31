/**
 * Capsule Version Pruning
 *
 * Implements multi-speed compaction pattern from Claude Code:
 * - >10 versions: summarize old versions, keep last 10 full
 * - >30 day old digests: compact to summary only
 * - Run log tiering: 7d full, 30d summary, 30+ metadata only
 */
import { all, get, run } from '../db.js';
import { logger } from '../logger.js';

// ── Schema bootstrapping ──────────────────────────────────────────────────────

let digestCompactedColumnEnsured = false;

/**
 * Ensure the `compacted` column exists on the `digests` table.
 * Called lazily before any compaction operation.
 */
function ensureDigestCompactedColumn(): void {
  if (digestCompactedColumnEnsured) return;
  try {
    run(`ALTER TABLE digests ADD COLUMN compacted INTEGER NOT NULL DEFAULT 0`);
    run(`CREATE INDEX IF NOT EXISTS idx_digests_compacted ON digests(compacted)`);
    logger.info('capsule-pruning: added compacted column to digests table');
  } catch {
    // Column already exists — ignore
  }
  digestCompactedColumnEnsured = true;
}

// ── Version pruning ───────────────────────────────────────────────────────────

/**
 * Prune old capsule versions.
 * Keeps the last `keepCount` versions with full content.
 * Older versions get content replaced with "[Pruned — see version N for latest]"
 */
export function pruneCapsuleVersions(capsuleId: string, keepCount: number = 10): number {
  const versions = all<{ id: string; version: number; content: string }>(
    `SELECT capsule_id AS id, version, content FROM capsule_versions
     WHERE capsule_id = ?
     ORDER BY version DESC`,
    [capsuleId]
  );

  if (versions.length <= keepCount) return 0;

  let pruned = 0;
  const toPrune = versions.slice(keepCount);
  const latestVersion = versions[0]?.version ?? 0;

  for (const v of toPrune) {
    if (v.content && v.content.length > 0 && !v.content.startsWith('[Pruned')) {
      run(
        `UPDATE capsule_versions SET content = ? WHERE capsule_id = ? AND version = ?`,
        [`[Pruned — see version ${latestVersion} for latest content]`, capsuleId, v.version]
      );
      pruned++;
    }
  }

  if (pruned > 0) {
    logger.info('Pruned capsule versions', { capsuleId, pruned, kept: keepCount });
  }

  return pruned;
}

// ── Digest compaction ─────────────────────────────────────────────────────────

/**
 * Compact old digests.
 * Digests older than `maxDays` get their detail fields cleared, keeping only summary.
 * Detects already-compacted entries via the `compactedAt` field in JSON content.
 */
export function compactOldDigests(companyId: string, maxDays: number = 30): number {
  ensureDigestCompactedColumn();

  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Find uncompacted digests older than cutoff
  const oldDigests = all<{ id: string; date: string; content: string }>(
    `SELECT id, date, content FROM digests
     WHERE company_id = ? AND date < ? AND compacted = 0`,
    [companyId, cutoff]
  );

  let compacted = 0;
  for (const digest of oldDigests) {
    try {
      let content: Record<string, unknown> = {};
      try {
        content = JSON.parse(digest.content) as Record<string, unknown>;
      } catch { continue; }

      // Skip if already compacted (belt-and-suspenders check)
      if (content.compactedAt) continue;

      // Keep only summary fields, remove detailed breakdowns
      const compactedContent = {
        date: digest.date,
        summary: content.summary ?? content.highlights ?? 'No summary available',
        totalRuns: content.totalRuns ?? 0,
        successRate: content.successRate ?? 0,
        compactedAt: new Date().toISOString(),
      };

      run(
        `UPDATE digests SET content = ?, compacted = 1 WHERE id = ?`,
        [JSON.stringify(compactedContent), digest.id]
      );
      compacted++;
    } catch (err) {
      logger.error('Failed to compact digest', { digestId: digest.id, error: String(err) });
    }
  }

  if (compacted > 0) {
    logger.info('Compacted old digests', { companyId, compacted, cutoffDate: cutoff });
  }

  return compacted;
}

// ── Run log tiering ───────────────────────────────────────────────────────────

/**
 * Tier run logs based on age.
 * - 0-7 days: full log_excerpt
 * - 7-30 days: truncated to first 1000 chars
 * - 30+ days: metadata only (log_excerpt cleared)
 */
export function tierRunLogs(companyId: string): { truncated: number; cleared: number } {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Tier 2: Truncate 7-30 day old logs to 1000 chars
  const midAgeRuns = all<{ id: string; log_excerpt: string }>(
    `SELECT id, log_excerpt FROM runs
     WHERE company_id = ? AND created_at < ? AND created_at >= ?
     AND log_excerpt IS NOT NULL AND length(log_excerpt) > 1000`,
    [companyId, sevenDaysAgo, thirtyDaysAgo]
  );

  let truncated = 0;
  for (const r of midAgeRuns) {
    run(
      `UPDATE runs SET log_excerpt = ? WHERE id = ?`,
      [r.log_excerpt.slice(0, 1000) + '\n... [truncated]', r.id]
    );
    truncated++;
  }

  // Tier 3: Clear 30+ day old logs
  run(
    `UPDATE runs SET log_excerpt = '[Archived — metadata only]'
     WHERE company_id = ? AND created_at < ?
     AND log_excerpt IS NOT NULL
     AND log_excerpt != '[Archived — metadata only]'
     AND log_excerpt != ''`,
    [companyId, thirtyDaysAgo]
  );
  // sql.js doesn't return changes count easily; log that the operation ran
  const cleared = 0;

  if (truncated > 0 || cleared > 0) {
    logger.info('Tiered run logs', { companyId, truncated, cleared });
  }

  return { truncated, cleared };
}
