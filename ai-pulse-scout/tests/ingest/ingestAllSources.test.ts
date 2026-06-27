import { describe, expect, it, vi } from 'vitest';
import { ingestAllSources } from '../../src/ingest/ingestAllSources';
import type { SourceConfig } from '../../src/types/config';
import type { ProductionSourceAdapter } from '../../src/adapters/types';

function makeSource(partial: Partial<SourceConfig>): SourceConfig {
  return {
    name: partial.name ?? 'Example Source',
    category: partial.category ?? 'frontier-model-labs',
    url: partial.url ?? 'https://example.com',
    type: partial.type ?? 'webpage',
    enabled: partial.enabled ?? true,
  };
}

function makeNormalizedItem(source: SourceConfig, index: number) {
  return {
    id: `item-${index + 1}`,
    sourceType: source.type,
    sourceUrl: source.url,
    sourceName: source.name,
    source_name: source.name,
    source_category: source.category,
    source_url: source.url,
    itemUrl: `https://example.com/items/${index + 1}`,
    canonicalUrl: `https://example.com/items/${index + 1}`,
    item_url: `https://example.com/items/${index + 1}`,
    title: `Item ${index + 1}`,
    publishedAt: `2026-05-26T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
    published_at: new Date(`2026-05-26T${String(index % 24).padStart(2, '0')}:00:00.000Z`),
    publishedAtConfidence: 'exact',
    discoveredAt: '2026-05-26T00:05:00.000Z',
    fetched_at: new Date('2026-05-26T00:05:00.000Z'),
    author: '',
    content: `AI item ${index + 1}`,
    content_text: `AI item ${index + 1}`,
    summaryMaterial: `AI item ${index + 1}`,
    summary: `AI item ${index + 1}`,
    stableIdentity: `id:item-${index + 1}`,
    topicHints: [],
    tags: [],
    content_type: 'article',
    fingerprint: `fp-${index + 1}`,
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
  };
}

describe('ingestAllSources', () => {
  it('dispatches sources to matching production adapters and merges normalized items', async () => {
    const rssSource = makeSource({ name: 'RSS Source', type: 'rss', url: 'https://example.com/feed.xml' });
    const webpageSource = makeSource({ name: 'Web Source', type: 'webpage', url: 'https://example.com/blog' });

    const feedAdapter: ProductionSourceAdapter = {
      canHandle: (source) => source.type === 'rss',
      ingest: vi.fn(async (source) => ({
        source,
        status: 'production_supported',
        items: [
          {
            sourceType: 'rss',
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: 'https://example.com/feed-item',
            canonicalUrl: 'https://example.com/feed-item',
            title: 'LLM Feed Item',
            publishedAt: '2026-05-26T00:00:00.000Z',
            publishedAtConfidence: 'exact',
            discoveredAt: '2026-05-26T00:05:00.000Z',
            content: 'Feed content about LLM inference systems',
            summaryMaterial: 'Feed content about LLM inference systems',
            stableIdentity: 'id:feed-item',
            topicHints: [],
            rawMetadata: {},
          },
        ],
        diagnostics: { attempted: 1, normalized: 1, dropped: 0 },
      })),
    };

    const webAdapter: ProductionSourceAdapter = {
      canHandle: (source) => source.type === 'webpage',
      ingest: vi.fn(async (source) => ({
        source,
        status: 'production_supported',
        items: [
          {
            sourceType: 'webpage',
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: 'https://example.com/blog/post-1',
            canonicalUrl: 'https://example.com/blog/post-1',
            title: 'AI Web Item',
            publishedAt: '2026-05-25T20:00:00.000Z',
            publishedAtConfidence: 'inferred',
            discoveredAt: '2026-05-26T00:05:00.000Z',
            content: 'Web content about AI product deployment',
            summaryMaterial: 'Web content about AI product deployment',
            stableIdentity: 'id:web-item',
            topicHints: ['AI Products & Platforms'],
            rawMetadata: { extractionMethod: 'article_html' },
          },
        ],
        diagnostics: { attempted: 1, normalized: 1, dropped: 0 },
      })),
    };

    const result = await ingestAllSources({
      sources: [rssSource, webpageSource],
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
      adapters: [feedAdapter, webAdapter],
    });

    expect(feedAdapter.ingest).toHaveBeenCalledOnce();
    expect(webAdapter.ingest).toHaveBeenCalledOnce();
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sourceType)).toEqual(['rss', 'webpage']);
    expect(result.summary.byStatus.production_supported).toBe(2);
  });

  it('caps each source to 20 items before merge', async () => {
    const rssSource = makeSource({ name: 'Large RSS Source', type: 'rss', url: 'https://example.com/large-feed.xml' });

    const feedAdapter: ProductionSourceAdapter = {
      canHandle: (source) => source.type === 'rss',
      ingest: vi.fn(async (source) => ({
        source,
        status: 'production_supported',
        items: Array.from({ length: 25 }, (_, index) => makeNormalizedItem(source, index) as any),
        diagnostics: { attempted: 25, normalized: 25, dropped: 0 },
      })),
    };

    const result = await ingestAllSources({
      sources: [rssSource],
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
      adapters: [feedAdapter],
    });

    expect(result.items).toHaveLength(20);
    expect(result.summary.totalItems).toBe(20);
    expect(result.results[0]?.diagnostics.capped).toBe(20);
    expect(result.results[0]?.diagnostics.dropped).toBe(5);
  });

  it('marks unsupported sources honestly when no adapter can ingest them', async () => {
    const docsSource = makeSource({ name: 'Docs Source', type: 'docs', url: 'https://example.com/docs' });

    const result = await ingestAllSources({
      sources: [docsSource],
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
      adapters: [],
    });

    expect(result.items).toEqual([]);
    expect(result.results[0]?.status).toBe('broken');
    expect(result.results[0]?.diagnostics.reason).toContain('No production adapter');
  });
});
