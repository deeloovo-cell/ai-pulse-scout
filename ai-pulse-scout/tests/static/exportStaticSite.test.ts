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
  it('writes only index.html and removes old archive pages', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });
    writeFileSync(join(daysDir, '2026-06-03.html'), '<html>old archive</html>');

    const result = await exportStaticSite({
      outputDir,
      siteTitle: 'AI Pulse Scout Daily',
      targetDate: '2026-05-30',
      items: [makeItem()],
    });

    expect(result.indexPath).toBe(join(outputDir, 'index.html'));
    const indexHtml = readFileSync(result.indexPath, 'utf8');

    expect(indexHtml).toContain('AI Pulse Scout Daily');
    expect(indexHtml).not.toContain('最近 7 天');
    expect(indexHtml).toContain('Exported item');
    expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
    expect(existsSync(join(daysDir, '2026-06-03.html'))).toBe(false);
    expect(existsSync(daysDir)).toBe(false);
  });

  it('removes every stale archive page even when multiple files exist', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ai-pulse-scout-static-refresh-'));
    tempDirs.push(outputDir);
    const daysDir = join(outputDir, 'days');
    mkdirSync(daysDir, { recursive: true });

    writeFileSync(join(daysDir, '2026-06-01.html'), '<html><body><article class="digest-card">historical-0601</article></body></html>');
    writeFileSync(join(daysDir, '2026-05-31.html'), '<html><body><article class="digest-card">historical-0531</article></body></html>');

    await exportStaticSite({
      outputDir,
      siteTitle: 'The Daily Scout',
      targetDate: '2026-06-03',
      items: [makeItem({ title: 'Latest digest item' })],
    });

    expect(existsSync(join(daysDir, '2026-06-01.html'))).toBe(false);
    expect(existsSync(join(daysDir, '2026-05-31.html'))).toBe(false);
    expect(existsSync(daysDir)).toBe(false);
  });
});
