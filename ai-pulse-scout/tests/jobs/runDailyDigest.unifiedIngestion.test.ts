import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ingest/ingestAllSources', () => ({
  ingestAllSources: vi.fn(async () => ({
    items: [
      {
        sourceType: 'webpage',
        sourceUrl: 'https://example.com/blog',
        sourceName: 'Web Source',
        itemUrl: 'https://example.com/blog/post-1',
        canonicalUrl: 'https://example.com/blog/post-1',
        title: 'Web Item',
        publishedAt: '2026-05-26T00:00:00.000Z',
        publishedAtConfidence: 'exact',
        discoveredAt: '2026-05-26T00:01:00.000Z',
        content: 'Body',
        summaryMaterial: 'Body',
        stableIdentity: 'url:https://example.com/blog/post-1',
        topicHints: [],
        rawMetadata: {},
        id: 'id-1',
        source_name: 'Web Source',
        source_category: 'webpage',
        source_url: 'https://example.com/blog',
        item_url: 'https://example.com/blog/post-1',
        published_at: new Date('2026-05-26T00:00:00.000Z'),
        fetched_at: new Date('2026-05-26T00:01:00.000Z'),
        author: '',
        content_text: 'Body',
        summary: 'Body',
        tags: [],
        content_type: 'article',
        fingerprint: 'url:https://example.com/blog/post-1',
        relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
        decision: 'pending',
        decision_reason: '',
        primary_topic: 'AI News Roundup',
      },
    ],
    results: [],
    summary: {
      totalSources: 1,
      totalItems: 1,
      byStatus: {
        production_supported: 1,
        partial_supported: 0,
        discoverable_only: 0,
        deferred: 0,
        broken: 0,
      },
    },
  })),
}));

describe('runDailyDigest unified ingestion', () => {
  it('uses unified ingestion items instead of feed-only fetch results', async () => {
    const module = await import('../../src/jobs/runDailyDigest');
    const result = await module.runDailyDigest();
    expect(result.totalFetched).toBe(1);
  });
});
