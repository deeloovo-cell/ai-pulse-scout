import { describe, expect, it, vi } from 'vitest';
import { GenericWebAdapter } from '../../src/adapters/genericWebAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Web Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/blog',
  type: 'webpage',
  enabled: true,
};

describe('GenericWebAdapter integration', () => {
  it('upgrades listing candidates into article-grade items and keeps degraded fallbacks', async () => {
    const htmlByUrl = new Map([
      ['https://example.com/blog', '<a href="/blog/post-1">Post 1</a><a href="/blog/post-2">Post 2</a>'],
      ['https://example.com/blog/post-1', '<title>Post 1</title><article><p>Body 1</p></article><meta property="article:published_time" content="2026-05-26T00:00:00Z" />'],
      ['https://example.com/blog/post-2', '<title>Post 2</title>'],
    ]);

    const adapter = new GenericWebAdapter({
      fetchHtml: vi.fn(async (url: string) => {
        const html = htmlByUrl.get(url);
        if (!html) throw new Error(`missing fixture for ${url}`);
        return html;
      }),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].rawMetadata).toMatchObject({ extractionLevel: 'article_full' });
    expect(result.items[1].rawMetadata).toMatchObject({ extractionLevel: 'link_only' });
  });

  it('marks the source broken when the entry page fetch fails', async () => {
    const adapter = new GenericWebAdapter({
      fetchHtml: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('broken');
    expect(result.items).toEqual([]);
  });
});
