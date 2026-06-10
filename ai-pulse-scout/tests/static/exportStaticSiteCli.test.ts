import { describe, expect, it } from 'vitest';
import {
  capStaticDigestItems,
  computeAutoDeployDigestDate,
  computeDigestWindowForDate,
  defaultStaticSiteOutputDir,
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
  it('keeps the top 60 ordered items for static digest export', () => {
    const items = Array.from({ length: 70 }, (_, index) => ({ id: `item-${index + 1}` }));

    expect(capStaticDigestItems(items)).toHaveLength(60);
    expect(capStaticDigestItems(items).map((item) => item.id)).toEqual(
      Array.from({ length: 60 }, (_, index) => `item-${index + 1}`),
    );
  });

  it('limits arXiv as one source family before filling the static cap', () => {
    const arxivItems = Array.from({ length: 60 }, (_, index) => ({
      id: `arxiv-${index + 1}`,
      source_name: index % 2 === 0 ? 'arXiv CS.AI' : 'arXiv CS.LG',
      source_url: index % 2 === 0 ? 'https://arxiv.org/rss/cs.AI' : 'https://arxiv.org/rss/cs.LG',
    }));
    const externalItems = [
      { id: 'google-cloud', source_name: 'Google Cloud Blog AI & Machine Learning', source_url: 'https://cloudblog.withgoogle.com/products/ai-machine-learning/rss/' },
      { id: 'simon-willison', source_name: 'Simon Willison Everything', source_url: 'http://feeds.simonwillison.net/swn-everything' },
    ];

    const capped = capStaticDigestItems([...arxivItems, ...externalItems]);

    expect(capped).toHaveLength(60);
    expect(capped.map((item) => item.id)).toContain('google-cloud');
    expect(capped.map((item) => item.id)).toContain('simon-willison');
    expect(capped.slice(0, 12).map((item) => item.id)).toEqual([
      ...Array.from({ length: 10 }, (_, index) => `arxiv-${index + 1}`),
      'google-cloud',
      'simon-willison',
    ]);
  });
});
