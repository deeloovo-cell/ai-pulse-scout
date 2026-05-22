import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { summarizeCoverage } from '../src/inbox/coverageReport.js';
import type { CoverageResult } from '../src/inbox/types.js';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';
import { runSourceCoverage } from '../src/jobs/runSourceCoverage.js';

describe('coverage reporting', () => {
  it('counts sources by status', () => {
    const results = [
      { status: 'success', discoveredCount: 3 },
      { status: 'remove', discoveredCount: 0, removalReason: 'Auth-gated or unreadable' },
      { status: 'failed', discoveredCount: 0 },
    ] as CoverageResult[];

    expect(summarizeCoverage(results)).toMatchObject({
      totalSources: 3,
      success: 1,
      remove: 1,
      failed: 1,
    });
  });
});

describe('real source inbox coverage baseline', () => {
  it('parses all source inbox URLs into universe records', () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    expect(universe.length).toBe(123);
  });
});

describe('real inbox coverage summary', () => {
  it('accounts for every source in the coverage summary', async () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    const results = await runSourceCoverage(universe);
    const summary = summarizeCoverage(results);

    expect(summary.totalSources).toBe(123);
    expect(summary.success + summary.empty + summary.remove + summary.failed).toBe(123);
  });

  it('marks at least one current social source for removal under the current baseline', async () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    const results = await runSourceCoverage(universe);

    expect(results.some((r) => r.status === 'remove')).toBe(true);
  });
});
