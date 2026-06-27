import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSelectedSnapshot } from '../../src/static/selectedSnapshot.js';
import { renderStaticSiteFromSnapshot } from '../../src/cli/renderStaticSiteFromSnapshot.js';

function makeItem(title: string, id: string) {
  return {
    id,
    source_name: 'Example',
    source_category: 'blog',
    source_url: 'https://example.com/feed.xml',
    item_url: `https://example.com/${id}`,
    title,
    published_at: null,
    fetched_at: new Date('2026-06-27T00:00:00.000Z'),
    author: '',
    content_text: 'Hello',
    content_html: undefined,
    summary: 'Hello',
    tags: [],
    content_type: 'article',
    fingerprint: `fp-${id}`,
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI Developer Tools & Agents',
  };
}

describe('renderStaticSiteFromSnapshot flow', () => {
  it('renders html with the same digest-card count as snapshot items', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-static-from-snapshot-'));
    const outputDir = join(dir, 'site');
    const snapshotPath = join(outputDir, 'selected-2026-06-27.json');
    const items = [makeItem('Post 1', '1'), makeItem('Post 2', '2')];

    await writeSelectedSnapshot(snapshotPath, items);
    await renderStaticSiteFromSnapshot({
      date: '2026-06-27',
      snapshotPath,
      outputDir,
      enrichItems: async (selected) => selected,
    });

    const html = readFileSync(join(outputDir, 'index.html'), 'utf8');
    expect((html.match(/class="digest-card"/g) || []).length).toBe(2);

    rmSync(dir, { recursive: true, force: true });
  });
});
