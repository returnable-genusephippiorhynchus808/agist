/**
 * Capsule Staleness Utilities
 *
 * Implements staleness-aware recall pattern from Claude Code.
 * LLMs can't do date arithmetic well, so we provide human-readable labels.
 */
import { logger } from '../logger.js';

export interface StalenessInfo {
  label: string;            // "today", "3 days ago", "47 days ago"
  isStale: boolean;         // true if > 30 days old
  needsAutoRefresh: boolean; // true if dynamic capsule > 7 days old
  daysSinceUpdate: number;
}

export function computeStaleness(updatedAt: string): StalenessInfo {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  if (diffDays === 0) {
    label = 'today';
  } else if (diffDays === 1) {
    label = 'yesterday';
  } else if (diffDays < 7) {
    label = `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    label = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    label = `${diffDays} days ago`;
  }

  return {
    label,
    isStale: diffDays > 30,
    needsAutoRefresh: diffDays > 7,
    daysSinceUpdate: diffDays,
  };
}

/**
 * Build a freshness caveat string to inject alongside capsule content.
 * Follows Claude Code pattern: stale content gets a system-level warning.
 */
export function buildFreshnessCaveat(capsuleName: string, staleness: StalenessInfo): string | null {
  if (staleness.daysSinceUpdate <= 1) return null;

  if (staleness.isStale) {
    return `[WARNING: Capsule "${capsuleName}" was last updated ${staleness.label}. Content may be outdated — verify before acting on it.]`;
  }

  if (staleness.daysSinceUpdate > 3) {
    return `[Note: Capsule "${capsuleName}" was last updated ${staleness.label}.]`;
  }

  return null;
}

/**
 * Build a capsule manifest — one-line summary per capsule for index injection.
 * Follows Claude Code MEMORY.md pattern: pointer list, not content.
 */
export function buildCapsuleManifest(capsules: Array<{
  id: string;
  name: string;
  type: string;
  priority: string;
  updatedAt: string;
}>): string {
  if (capsules.length === 0) return '(No capsules available)';

  const lines = capsules
    .sort((a, b) => {
      // Sort by priority: instruction > memory > ephemeral
      const priorityOrder: Record<string, number> = { instruction: 0, memory: 1, ephemeral: 2 };
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    })
    .map(c => {
      const staleness = computeStaleness(c.updatedAt);
      return `- [${c.priority}] ${c.name} (${c.type}, updated ${staleness.label}): ${c.id}`;
    });

  logger.debug('capsule-staleness: built manifest', { count: capsules.length });

  return lines.join('\n');
}
