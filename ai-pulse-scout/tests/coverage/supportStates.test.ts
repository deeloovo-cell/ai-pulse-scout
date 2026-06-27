import { describe, expect, it } from 'vitest';
import { summarizeCoverage } from '../../src/inbox/coverageReport.js';

describe('summarizeCoverage', () => {
  it('summarizes mixed source outcomes consistently', () => {
    const summary = summarizeCoverage([
      {
        source: { url: 'https://ok.example.com', section: 'rss', classification: { traversable: true, strategy: 'rss', rationale: 'ok' } },
        status: 'success',
        discoveredCount: 5,
      },
      {
        source: { url: 'https://empty.example.com', section: 'rss', classification: { traversable: true, strategy: 'rss', rationale: 'ok' } },
        status: 'empty',
        discoveredCount: 0,
      },
      {
        source: { url: 'https://failed.example.com', section: 'rss', classification: { traversable: true, strategy: 'rss', rationale: 'ok' } },
        status: 'failed',
        discoveredCount: 0,
        error: 'Status code 404',
      },
    ] as any);

    expect(summary.totalSources).toBe(3);
    expect(summary.success).toBe(1);
    expect(summary.empty).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.discoveredPosts).toBe(5);
    expect(summary.failureReasons).toEqual({ 'Status code 404': 1 });
  });
});
