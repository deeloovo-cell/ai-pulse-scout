import { describe, expect, it } from 'vitest';
import { computeDigestWindowForDate, defaultStaticSiteOutputDir } from '../../src/static/exportStaticSiteCli.js';

describe('computeDigestWindowForDate', () => {
  it('uses the daily 07:00 Asia/Shanghai cutoff for a target digest date', () => {
    const { windowStart, windowEnd } = computeDigestWindowForDate('2026-05-30');

    expect(windowStart.toISOString()).toBe('2026-05-28T23:00:00.000Z');
    expect(windowEnd.toISOString()).toBe('2026-05-29T23:00:00.000Z');
  });
});

describe('defaultStaticSiteOutputDir', () => {
  it('points to data/output/site under the project root', () => {
    expect(defaultStaticSiteOutputDir()).toMatch(/data\/output\/site$/);
  });
});
