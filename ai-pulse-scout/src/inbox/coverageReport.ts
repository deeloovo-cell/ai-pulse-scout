import type { CoverageResult } from './types.js';

export function summarizeCoverage(results: CoverageResult[]) {
  return {
    totalSources: results.length,
    success: results.filter((r) => r.status === 'success').length,
    empty: results.filter((r) => r.status === 'empty').length,
    remove: results.filter((r) => r.status === 'remove').length,
    failed: results.filter((r) => r.status === 'failed').length,
    discoveredPosts: results.reduce((sum, r) => sum + r.discoveredCount, 0),
  };
}
