import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedAdapter } from '../../src/adapters/feedAdapter';
import type { SourceConfig } from '../../src/types/config';
import * as rssFetcher from '../../src/fetchers/rssFetcher';

vi.mock('../../src/fetchers/rssFetcher', () => ({
  fetchRssSource: vi.fn(async (source: SourceConfig) => ({
    source,
    items: [
      {
        source_name: source.name,
        source_category: source.category,
        source_url: source.url,
        item_url: source.url.includes('arxiv.org') ? 'https://arxiv.org/abs/2606.00001' : 'https://example.com/post-1',
        title: source.url.includes('arxiv.org') ? 'RSS Paper Title' : 'Post 1',
        author: 'Author One',
        content_text: source.url.includes('arxiv.org') ? 'Paper summary text.' : 'Body',
        published_at: new Date('2026-06-01T00:00:00.000Z'),
        fetched_at: new Date('2026-06-01T00:01:00.000Z'),
        tags: [],
        content_type: 'article',
      },
    ],
  })),
}));

const source: SourceConfig = {
  name: 'Feed Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/feed.xml',
  type: 'rss',
  enabled: true,
};

describe('FeedAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes fetched feed items into production ingestion items', async () => {
    const adapter = new FeedAdapter();

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('production_supported');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'Post 1',
      source_name: source.name,
      item_url: 'https://example.com/post-1',
    });
    expect(result.diagnostics.normalized).toBe(1);
  });

  it('routes arxiv rss sources through the normal rss fetch path', async () => {
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

    expect(rssFetcher.fetchRssSource).toHaveBeenCalledWith(
      arxivSource,
      new Date('2026-05-31T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(result.status).toBe('production_supported');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: 'RSS Paper Title',
      source_name: 'arXiv CS.AI',
      item_url: 'https://arxiv.org/abs/2606.00001',
    });
  });

  it('degrades gracefully when rss ingestion fails for a source', async () => {
    vi.mocked(rssFetcher.fetchRssSource).mockRejectedValueOnce(new Error('Rate exceeded.'));

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

    expect(result.status).toBe('partial_supported');
    expect(result.items).toHaveLength(0);
    expect(result.diagnostics.reason).toContain('Rate exceeded');
  });
});
