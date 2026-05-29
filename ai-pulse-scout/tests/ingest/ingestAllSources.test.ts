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
