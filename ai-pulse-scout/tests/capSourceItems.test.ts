import { describe, expect, it } from 'vitest';
import { capSourceItems } from '../src/filtering/capSourceItems.js';
import { ingestAllSources } from '../src/ingest/ingestAllSources.js';
import type { ProductionSourceAdapter } from '../src/adapters/types.js';
import type { SourceConfig } from '../src/types/config.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'item',
    source_name: 'arXiv cs.AI',
    source_category: 'research',
    source_url: 'https://arxiv.org/rss/cs.AI',
    item_url: 'https://example.com/item',
    title: 'AI item',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'AI model systems content',
    summary: 'AI summary',
    tags: [],
    content_type: 'research',
    fingerprint: 'fp',
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
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

function makeSource(name: string, url: string): SourceConfig {
  return {
    name,
    category: 'research',
    url,
    type: 'rss',
    enabled: true,
  };
}

describe('capSourceItems', () => {
  it('drops non-ai items before ranking and truncation', () => {
    const result = capSourceItems(
      [
        makeItem({ id: 'ai-1', title: 'LLM inference serving for agents' }),
        makeItem({
          id: 'non-ai',
          title: 'Build cache tuning for CI pipelines',
          summary: 'No AI content here',
          content_type: 'article',
        }),
      ],
      10,
    );

    expect(result.items.map((item) => item.id)).toEqual(['ai-1']);
    expect(result.counts.aiRejected).toBe(1);
  });

  it('keeps only the top 10 per source after ranking', () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      makeItem({
        id: `item-${index + 1}`,
        title: `LLM systems item ${index + 1}`,
        published_at: new Date(`2026-05-29T${String(index).padStart(2, '0')}:00:00Z`),
      }),
    );

    const result = capSourceItems(items, 10);

    expect(result.items).toHaveLength(10);
    expect(result.counts.raw).toBe(12);
    expect(result.counts.aiAccepted).toBe(12);
    expect(result.counts.capped).toBe(10);
    expect(result.items[0]?.id).toBe('item-12');
    expect(result.items.at(-1)?.id).toBe('item-3');
  });

  it('uses extraction level and timestamp confidence as tie-breakers', () => {
    const result = capSourceItems(
      [
        makeItem({
          id: 'link-only',
          title: 'AI ranking item A',
          published_at: new Date('2026-05-29T10:00:00Z'),
          rawMetadata: { extractionLevel: 'link_only', publishedAtConfidence: 'derived' },
        }),
        makeItem({
          id: 'partial',
          title: 'AI ranking item B',
          published_at: new Date('2026-05-29T10:00:00Z'),
          rawMetadata: { extractionLevel: 'article_partial', publishedAtConfidence: 'derived' },
        }),
        makeItem({
          id: 'full',
          title: 'AI ranking item C',
          published_at: new Date('2026-05-29T10:00:00Z'),
          rawMetadata: { extractionLevel: 'article_full', publishedAtConfidence: 'exact' },
        }),
      ],
      10,
    );

    expect(result.items.map((item) => item.id)).toEqual(['full', 'partial', 'link-only']);
  });
});

describe('ingestAllSources', () => {
  it('caps each source before merge and reports source-level counts', async () => {
    const sourceA = makeSource('Source A', 'https://example.com/a.xml');
    const sourceB = makeSource('Source B', 'https://example.com/b.xml');

    const adapter: ProductionSourceAdapter = {
      canHandle: () => true,
      ingest: async ({ source }) => ({
        source,
        status: 'production_supported',
        diagnostics: { attempted: 12, normalized: 12, dropped: 0, adapterType: 'feed' },
        items: Array.from({ length: 12 }, (_, index) =>
          makeItem({
            id: `${source.name}-${index + 1}`,
            source_name: source.name,
            source_url: source.url,
            title: `LLM systems ${source.name} ${index + 1}`,
            published_at: new Date(`2026-05-29T${String(index).padStart(2, '0')}:00:00Z`),
          }),
        ),
      }),
    };

    const result = await ingestAllSources({
      sources: [sourceA, sourceB],
      windowStart: new Date('2026-05-29T00:00:00Z'),
      windowEnd: new Date('2026-05-30T00:00:00Z'),
      adapters: [adapter],
    });

    expect(result.items).toHaveLength(20);
    expect(result.summary.totalItems).toBe(20);
    expect(result.results[0]?.diagnostics.aiAccepted).toBe(12);
    expect(result.results[0]?.diagnostics.capped).toBe(10);
    expect(result.results[1]?.diagnostics.capped).toBe(10);
  });
});
