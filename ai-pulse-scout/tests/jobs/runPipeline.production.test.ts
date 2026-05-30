import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { NormalizedItem } from '../../src/types/item.js';
import { runPipeline } from '../../src/jobs/runPipeline.js';

function makeItem(id: string, title: string): NormalizedItem {
  return {
    id,
    title,
    source_name: 'Source',
    source_category: 'webpage',
    source_url: 'https://example.com',
    item_url: `https://example.com/${id}`,
    published_at: new Date('2026-05-30T00:00:00.000Z'),
    fetched_at: new Date('2026-05-30T00:00:00.000Z'),
    author: '',
    content_text: 'Body',
    summary: 'Summary',
    tags: [],
    content_type: 'article',
    fingerprint: id,
    relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
  } as any;
}

describe('runPipeline production snapshots', () => {
  it('passes reconstructed normalized items to render', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-pipeline-prod-'));
    const render = vi.fn(() => '<html>digest</html>');

    await runPipeline({
      now: new Date('2026-05-30T07:00:00.000Z'),
      dbPath: join(dir, 'pipeline.sqlite'),
      ingest: async () => ({
        items: [
          { id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a', normalizedItem: makeItem('1', 'A') },
        ],
      }),
      fetchItem: async (item) => ({ rawContent: item.title, cleanContent: item.title, fetchMethod: 'test' }),
      enrichItem: async () => ({
        summary: 'Summary',
        whyItMatters: 'Why',
        topics: ['AI Infra'],
        relevanceScore: 0.9,
        relevanceBucket: 'high',
        rawResponse: '{}',
        model: 'test-model',
        durationMs: 10,
      }),
      render,
      publish: async () => undefined,
    });

    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0]?.[0]).toMatchObject([{ title: 'A', source_name: 'Source' }]);

    rmSync(dir, { recursive: true, force: true });
  });
});
