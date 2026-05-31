import { describe, expect, it, vi } from 'vitest';
import { FeedAdapter } from '../../src/adapters/feedAdapter';
import type { SourceConfig } from '../../src/types/config';

vi.mock('../../src/adapters/arxivApi', () => ({
  isArxivRssSourceUrl: (url: string) => url.startsWith('https://arxiv.org/rss/'),
  fetchArxivApiEntriesForSource: vi.fn(async (_source: SourceConfig, windowStart: Date, _windowEnd: Date) => [
    {
      sourceType: 'rss',
      sourceUrl: 'https://arxiv.org/rss/cs.AI',
      sourceName: 'arXiv CS.AI',
      itemUrl: 'https://arxiv.org/abs/2605.99999v1',
      canonicalUrl: 'https://arxiv.org/abs/2605.99999v1',
      title: 'API Paper Title',
      publishedAt: windowStart.toISOString(),
      publishedAtConfidence: 'exact',
      discoveredAt: windowStart.toISOString(),
      content: 'Paper summary text.',
      summaryMaterial: 'Paper summary text.',
      stableIdentity: 'arxiv:2605.99999v1',
      topicHints: ['research'],
      rawMetadata: { adapterType: 'arxiv-api' },
      id: 'arxiv-item-1',
      source_name: 'arXiv CS.AI',
      source_category: 'research',
      source_url: 'https://arxiv.org/rss/cs.AI',
      item_url: 'https://arxiv.org/abs/2605.99999v1',
      published_at: new Date(windowStart.toISOString()),
      fetched_at: new Date(windowStart.toISOString()),
      author: 'Author One',
      content_text: 'Paper summary text.',
      summary: 'Paper summary text.',
      tags: ['cs.AI'],
      content_type: 'article',
      fingerprint: 'arxiv:2605.99999v1',
      relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
      decision: 'pending',
      decision_reason: '',
      primary_topic: 'research',
    },
  ]),
}));

const source: SourceConfig = {
  name: 'Feed Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/feed.xml',
  type: 'rss',
  enabled: true,
};

describe('FeedAdapter', () => {
  it('normalizes fetched feed items into production ingestion items', async () => {
    const adapter = new FeedAdapter({
      fetchFeedItems: vi.fn(async () => [
        {
          sourceType: 'rss',
          sourceUrl: source.url,
          sourceName: source.name,
          itemUrl: 'https://example.com/post-1',
          canonicalUrl: 'https://example.com/post-1',
          title: 'Post 1',
          publishedAt: '2026-05-26T00:00:00.000Z',
          publishedAtConfidence: 'exact',
          discoveredAt: '2026-05-26T00:01:00.000Z',
          content: 'Body',
          summaryMaterial: 'Body',
          stableIdentity: 'url:https://example.com/post-1',
          topicHints: [],
          rawMetadata: {},
          id: 'test-id',
          source_name: source.name,
          source_category: source.category,
          source_url: source.url,
          item_url: 'https://example.com/post-1',
          published_at: new Date('2026-05-26T00:00:00.000Z'),
          fetched_at: new Date('2026-05-26T00:01:00.000Z'),
          author: '',
          content_text: 'Body',
          summary: 'Body',
          tags: [],
          content_type: 'article',
          fingerprint: 'url:https://example.com/post-1',
          relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
          decision: 'pending',
          decision_reason: '',
          primary_topic: 'AI News Roundup',
        },
      ]),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('production_supported');
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics.normalized).toBe(1);
  });

  it('routes arxiv rss sources through the arxiv api path', async () => {
    const adapter = new FeedAdapter();
    const arxivSource: SourceConfig = {
      name: 'arXiv CS.AI',
      category: 'research',
      url: 'https://arxiv.org/rss/cs.AI',
      type: 'rss',
      enabled: true,
      coverage_status: 'live',
    };

    const result = await adapter.ingest({
      source: arxivSource,
      windowStart: new Date('2026-05-31T00:00:00.000Z'),
      windowEnd: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(result.status).toBe('production_supported');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'API Paper Title',
      source_name: 'arXiv CS.AI',
      item_url: 'https://arxiv.org/abs/2605.99999v1',
    });
    expect(result.diagnostics.normalized).toBe(1);
  });
});
