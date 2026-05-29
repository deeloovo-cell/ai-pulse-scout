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
      {
        sourceType: 'webpage',
        sourceUrl: 'https://example.com/labs',
        sourceName: 'Lab Source',
        itemUrl: 'https://example.com/labs/post-2',
        canonicalUrl: 'https://example.com/labs/post-2',
        title: 'Lab Item',
        publishedAt: '2026-05-26T01:00:00.000Z',
        publishedAtConfidence: 'exact',
        discoveredAt: '2026-05-26T01:01:00.000Z',
        content: 'Body2',
        summaryMaterial: 'Body2',
        stableIdentity: 'url:https://example.com/labs/post-2',
        topicHints: [],
        rawMetadata: {},
        id: 'id-2',
        source_name: 'Lab Source',
        source_category: 'webpage',
        source_url: 'https://example.com/labs',
        item_url: 'https://example.com/labs/post-2',
        published_at: new Date('2026-05-26T01:00:00.000Z'),
        fetched_at: new Date('2026-05-26T01:01:00.000Z'),
        author: '',
        content_text: 'Body2',
        summary: 'Body2',
        tags: [],
        content_type: 'article',
        fingerprint: 'url:https://example.com/labs/post-2',
        relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
        decision: 'pending',
        decision_reason: '',
        primary_topic: 'Frontier Model Labs',
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
  it('uses unified ingestion items instead of feed-only fetch results and renders full chinese digest without executive brief', async () => {
    const module = await import('../../src/jobs/runDailyDigest');
    const result = await module.runDailyDigest();
    expect(result.totalFetched).toBe(2);
    expect(result.itemCount).toBe(2);
    expect(result.html).toContain('今日 AI 情报');
    expect(result.html).not.toContain('Executive brief');
    expect(result.html).toContain('新闻速览');
    expect(result.html).toContain('前沿模型实验室');
    expect(result.html).toContain('共 2 条');
  });
});
