import type { CoverageResult } from './types.js';

export function summarizeCoverage(results: CoverageResult[]) {
  const failureReasons: Record<string, number> = {};

  for (const result of results) {
    if (result.status !== 'failed') continue;
    const reason = normalizeFailureReason(result.error);
    failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
  }

  return {
    totalSources: results.length,
    success: results.filter((r) => r.status === 'success').length,
    empty: results.filter((r) => r.status === 'empty').length,
    remove: results.filter((r) => r.status === 'remove').length,
    failed: results.filter((r) => r.status === 'failed').length,
    discoveredPosts: results.reduce((sum, r) => sum + r.discoveredCount, 0),
    failureReasons,
  };
}

function normalizeFailureReason(error?: string): string {
  if (!error) return 'unknown';
  const trimmed = error.trim();
  if (/Status code \d+/.test(trimmed)) return trimmed.match(/Status code \d+/)?.[0] ?? trimmed;
  if (/Request timed out/i.test(trimmed)) return 'Request timed out';
  if (/Feed not recognized/i.test(trimmed)) return 'Feed not recognized';
  if (/Attribute without value/i.test(trimmed)) return 'Malformed XML';
  if (/Invalid character in entity name/i.test(trimmed)) return 'Malformed XML';
  return trimmed;
}
