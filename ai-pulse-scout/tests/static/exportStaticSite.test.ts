import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
      recentDays: ['2026-05-29'],
      items: [makeItem()],
    });

    expect(result.indexPath).toBe(join(outputDir, 'index.html'));
    expect(result.dayPath).toBe(join(outputDir, 'days', '2026-05-30.html'));

    const indexHtml = readFileSync(result.indexPath, 'utf8');
    const dayHtml = readFileSync(result.dayPath, 'utf8');

    expect(indexHtml).toContain('AI Pulse Scout Daily');
    expect(indexHtml).toContain('href="days/2026-05-29.html"');
    expect(indexHtml).not.toContain('href="days/2026-05-30.html"');
    expect(dayHtml).toContain('href="../index.html"');
    expect(dayHtml).toContain('Exported item');
  });
});
