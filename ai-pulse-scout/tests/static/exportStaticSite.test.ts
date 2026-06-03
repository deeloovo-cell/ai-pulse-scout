import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportStaticSite } from '../../src/static/exportStaticSite.js';
import type { NormalizedItem } from '../../src/types/item.js';

const tempDirs: string[] = [];

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'static-export-1',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com/feed.xml',
    item_url: 'https://example.com/posts/static-export-1',
    title: 'Exported item',
    published_at: new Date('2026-05-30T03:00:00.000Z'),
    fetched_at: new Date('2026-05-30T04:00:00.000Z'),
    author: 'Tester',
    content_text: 'Full content for exported item.',
    summary: 'Summary for exported item.',
    tags: [],
    content_type: 'article',
    fingerprint: 'fp-static-export-1',
    relevance_scores: {
      ai_engineering: 0.8,
      industrial_ai: 0.2,
      cad_cae_cam: 0,
      executive_signal: 0.4,
      aac_relevance: 0.1,
      overall: 0.8,
    },
    decision: 'include',
    decision_reason: 'score=0.80',
    primary_topic: 'AI Developer Tools & Agents',
    rawMetadata: {},
    ...overrides,
  } as NormalizedItem;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('exportStaticSite', () => {
  it('writes both homepage and archive page files', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-'));
    tempDirs.push(outputDir);

    const result = await exportStaticSite({
      outputDir,
      siteTitle: 'AI Pulse Scout Daily',
      targetDate: '2026-05-30',
      recentDays: ['2026-06-02', '2026-06-01', '2026-05-30'],
      items: [makeItem()],
    });

    expect(result.indexPath).toBe(join(outputDir, 'index.html'));
    expect(result.dayPath).toBe(join(outputDir, 'days', '2026-05-30.html'));

    const indexHtml = readFileSync(result.indexPath, 'utf8');
    const dayHtml = readFileSync(result.dayPath, 'utf8');

    expect(indexHtml).toContain('AI Pulse Scout Daily');
    expect(indexHtml).not.toContain('最近 7 天');
    expect(indexHtml).not.toContain('href="days/2026-06-02.html"');
    expect(indexHtml).not.toContain('href="days/2026-05-30.html"');
    expect(dayHtml).not.toContain('最近 7 天');
    expect(dayHtml).not.toContain('href="2026-06-02.html"');
    expect(dayHtml).not.toContain('href="2026-05-30.html"');
    expect(dayHtml).not.toContain('返回首页');
    expect(dayHtml).toContain('Exported item');
  });

  it('keeps only the current day archive page', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-refresh-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });

    const historical0601 =
      '<html><body><nav class="nav"><h2>最近 7 天</h2><ol class="recent-days"><li><a href="2026-06-01.html">2026-06-01</a></li><li><a href="2026-05-26.html">2026-05-26</a></li></ol></nav><article class="digest-card">historical-0601</article></body></html>';
    const historical0531 =
      '<html><body><nav class="nav"><h2>最近 7 天</h2><ol class="recent-days"><li><a href="2026-05-31.html">2026-05-31</a></li><li><a href="2026-05-25.html">2026-05-25</a></li></ol></nav><article class="digest-card">historical-0531</article></body></html>';
    writeFileSync(join(daysDir, '2026-06-01.html'), historical0601);
    writeFileSync(join(daysDir, '2026-05-31.html'), historical0531);

    const result = await exportStaticSite({
      outputDir,
      siteTitle: 'The Daily Scout',
      targetDate: '2026-06-03',
      recentDays: ['2026-06-03', '2026-06-02', '2026-06-01', '2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28'],
      items: [makeItem({ title: 'Latest digest item' })],
    });

    const indexHtml = readFileSync(result.indexPath, 'utf8');
    const targetDayHtml = readFileSync(result.dayPath, 'utf8');

    expect(indexHtml).not.toContain('最近 7 天');
    expect(indexHtml).not.toContain('href="days/2026-06-03.html"');
    expect(indexHtml).not.toContain('href="days/2026-05-28.html"');
    expect(targetDayHtml).not.toContain('最近 7 天');
    expect(targetDayHtml).not.toContain('href="2026-06-03.html"');
    expect(targetDayHtml).not.toContain('href="2026-05-28.html"');
    expect(targetDayHtml).not.toContain('href="2026-05-27.html"');
    expect(existsSync(join(daysDir, '2026-06-03.html'))).toBe(true);
    expect(existsSync(join(daysDir, '2026-06-01.html'))).toBe(false);
    expect(existsSync(join(daysDir, '2026-05-31.html'))).toBe(false);
  });

  it('removes archive pages outside the current day', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-prune-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });

    const stalePath = join(daysDir, '2026-05-27.html');
    writeFileSync(stalePath, '<html><body>stale page</body></html>');
    writeFileSync(join(daysDir, '2026-05-28.html'), '<html><body><article class="digest-card">keep</article></body></html>');

    await exportStaticSite({
      outputDir,
      siteTitle: 'The Daily Scout',
      targetDate: '2026-06-03',
      recentDays: ['2026-06-03', '2026-06-02', '2026-06-01', '2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28'],
      items: [makeItem({ title: 'Latest digest item' })],
    });

    expect(existsSync(stalePath)).toBe(false);
    expect(existsSync(join(daysDir, '2026-05-28.html'))).toBe(false);
    expect(existsSync(join(daysDir, '2026-06-03.html'))).toBe(true);
  });

  it('does not render recent-days navigation for historical target pages', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-anchor-only-'));
    tempDirs.push(outputDir);

    const result = await exportStaticSite({
      outputDir,
      siteTitle: 'The Daily Scout',
      targetDate: '2026-05-28',
      recentDays: ['2026-06-03', '2026-06-02', '2026-06-01', '2026-05-31', '2026-05-30', '2026-05-29', '2026-05-28'],
      items: [makeItem({ title: 'Historical page item' })],
    });

    const dayHtml = readFileSync(result.dayPath, 'utf8');
    expect(dayHtml).toContain('Historical page item');
    expect(dayHtml).not.toContain('最近 7 天');
    expect(dayHtml).not.toContain('href="2026-06-03.html"');
    expect(dayHtml).not.toContain('href="2026-05-28.html"');
    expect(dayHtml).not.toContain('href="2026-05-27.html"');
  });
});
