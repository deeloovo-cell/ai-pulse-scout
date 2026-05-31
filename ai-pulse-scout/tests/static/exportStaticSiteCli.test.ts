import { describe, expect, it } from 'vitest';
import {
  computeAutoDeployDigestDate,
  computeDigestWindowForDate,
  defaultStaticSiteOutputDir,
} from '../../src/static/exportStaticSiteCli.js';

describe('computeDigestWindowForDate', () => {
  it('uses the daily 07:00 Asia/Shanghai cutoff for a target digest date', () => {
    const { windowStart, windowEnd } = computeDigestWindowForDate('2026-05-30');

    expect(windowStart.toISOString()).toBe('2026-05-28T23:00:00.000Z');
    expect(windowEnd.toISOString()).toBe('2026-05-29T23:00:00.000Z');
  });
});

describe('computeAutoDeployDigestDate', () => {
  it('uses the previous digest date before the 07:00 Shanghai cutoff', () => {
    const result = computeAutoDeployDigestDate(new Date('2026-05-31T22:30:00.000Z'));

    expect(result).toBe('2026-05-31');
  });

  it('uses the current digest date at or after the 07:00 Shanghai cutoff', () => {
    const result = computeAutoDeployDigestDate(new Date('2026-05-31T23:30:00.000Z'));

    expect(result).toBe('2026-06-01');
  });
});

describe('defaultStaticSiteOutputDir', () => {
  it('points to data/output/site under the project root', () => {
    expect(defaultStaticSiteOutputDir()).toMatch(/data\/output\/site$/);
  });
});
