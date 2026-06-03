import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  capStaticDigestItems,
  computeAutoDeployDigestDate,
  computeDigestWindowForDate,
  defaultStaticSiteOutputDir,
  resolveExistingRecentDays,
  resolveRecentDays,
  resolveStaticSiteBuildWindow,
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

describe('resolveStaticSiteBuildWindow', () => {
  it('prefers explicit window overrides over digest-date-derived daily window', () => {
    const result = resolveStaticSiteBuildWindow({
      digestDate: '2026-06-03',
      windowStartIso: '2026-06-01T07:32:18.000Z',
      windowEndIso: '2026-06-02T07:00:00.000Z',
    });

    expect(result.windowStart.toISOString()).toBe('2026-06-01T07:32:18.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    expect(result.source).toBe('explicit');
  });
});

describe('defaultStaticSiteOutputDir', () => {
  it('points to data/output/site under the project root', () => {
    expect(defaultStaticSiteOutputDir()).toMatch(/data\/output\/site$/);
  });
});

describe('capStaticDigestItems', () => {
  it('keeps the top 50 ordered items for static digest export', () => {
    const items = Array.from({ length: 70 }, (_, index) => ({ id: `item-${index + 1}` }));

    expect(capStaticDigestItems(items)).toHaveLength(50);
    expect(capStaticDigestItems(items).map((item) => item.id)).toEqual(
      Array.from({ length: 50 }, (_, index) => `item-${index + 1}`),
    );
  });
});

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveRecentDays', () => {
  it('includes the current target date and keeps a seven-day navigation window', () => {
    expect(resolveRecentDays('2026-06-02')).toEqual([
      '2026-06-02',
      '2026-06-01',
      '2026-05-31',
      '2026-05-30',
      '2026-05-29',
      '2026-05-28',
      '2026-05-27',
    ]);
  });

  it('anchors the seven-day navigation window to the latest digest day rather than the page being viewed', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-recent-days-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });

    writeFileSync(join(daysDir, '2026-06-02.html'), '<html><body><article class="digest-card">ok</article></body></html>');
    writeFileSync(join(daysDir, '2026-05-31.html'), '<html><body><article class="digest-card">ok</article></body></html>');
    writeFileSync(join(daysDir, '2026-05-30.html'), '<div class="empty-state">当前没有可展示的 digest 内容。</div>');

    await expect(resolveExistingRecentDays(outputDir, '2026-05-28', 7, '2026-06-03')).resolves.toEqual([
      '2026-06-03',
      '2026-06-02',
      '2026-06-01',
      '2026-05-31',
      '2026-05-30',
      '2026-05-29',
      '2026-05-28',
    ]);
  });
});
