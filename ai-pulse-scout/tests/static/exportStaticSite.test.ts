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
    expect(indexHtml).toContain('href="days/2026-06-02.html"');
    expect(indexHtml).toContain('href="days/2026-05-30.html"');
    expect(dayHtml).toContain('最近 7 天');
    expect(dayHtml).toContain('href="2026-06-02.html"');
    expect(dayHtml).toContain('href="2026-05-30.html"');
    expect(dayHtml).not.toContain('返回首页');
    expect(dayHtml).toContain('Exported item');
  });

  it('updates homepage and target-day navigation without overwriting historical archive content', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-refresh-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });

    const historical0601 = '<html><body><article class="digest-card">historical-0601</article></body></html>';
    const historical0531 = '<html><body><article class="digest-card">historical-0531</article></body></html>';
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
    const refreshed0601Html = readFileSync(join(daysDir, '2026-06-01.html'), 'utf8');
    const refreshed0531Html = readFileSync(join(daysDir, '2026-05-31.html'), 'utf8');

    expect(indexHtml).toContain('href="days/2026-06-03.html"');
    expect(indexHtml).toContain('href="days/2026-05-28.html"');
    expect(targetDayHtml).toContain('href="2026-06-03.html"');
    expect(targetDayHtml).toContain('href="2026-05-28.html"');
    expect(targetDayHtml).not.toContain('href="2026-05-27.html"');

    expect(refreshed0601Html).toBe(historical0601);
    expect(refreshed0531Html).toBe(historical0531);
  });

  it('removes archive pages that fall outside the latest seven-day window', async () => {
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
    expect(existsSync(join(daysDir, '2026-05-28.html'))).toBe(true);
  });

  it('does not force the currently viewed day into the recent-days nav when it falls outside the latest window', async () => {
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
    expect(dayHtml).toContain('href="2026-06-03.html"');
    expect(dayHtml).toContain('href="2026-05-28.html"');

    const navLine = dayHtml.match(/<ol class="recent-days">([\s\S]*?)<\/ol>/)?.[1] ?? '';
    expect(navLine.indexOf('2026-06-03.html')).toBeLessThan(navLine.indexOf('2026-05-28.html'));
    expect(navLine).not.toContain('href="2026-05-27.html"');
  });
});
