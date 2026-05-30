import { describe, expect, it, vi } from 'vitest';
import { FeedAdapter } from '../../src/adapters/feedAdapter';
import type { SourceConfig } from '../../src/types/config';

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
});
