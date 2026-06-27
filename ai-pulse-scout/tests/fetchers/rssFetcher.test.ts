import { describe, expect, it, vi } from 'vitest';
import type Parser from 'rss-parser';
import { fetchRssSource } from '../../src/fetchers/rssFetcher.js';
import type { SourceConfig } from '../../src/types/config.js';

function makeSource(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    name: overrides.name ?? 'Example Feed',
    category: overrides.category ?? 'blog',
    url: overrides.url ?? 'https://example.com/feed.xml',
    type: overrides.type ?? 'rss',
    enabled: overrides.enabled ?? true,
  };
}

describe('fetchRssSource', () => {
  it('fetches rss xml with explicit headers before parsing', async () => {
    const source = makeSource();
    const fetchImpl = vi.fn(async () => new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Feed</title>
      <item><title>Post 1</title><link>https://example.com/post-1</link><pubDate>Fri, 27 Jun 2026 00:00:00 GMT</pubDate><description>Hello</description></item>
      </channel></rss>`,
      { status: 200, headers: { 'content-type': 'application/rss+xml' } },
    ));
    const parseString = vi.fn(async () => ({
      items: [
        {
          title: 'Post 1',
          link: 'https://example.com/post-1',
          pubDate: 'Fri, 27 Jun 2026 00:00:00 GMT',
          content: 'Hello',
          contentSnippet: 'Hello',
        },
      ],
    }));

    const result = await fetchRssSource(source, new Date('2026-06-26T00:00:00.000Z'), new Date('2026-06-28T00:00:00.000Z'), {
      fetchImpl,
      parser: { parseString } as Pick<Parser, 'parseString'>,
      sleep: vi.fn(),
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(source.url);
    expect(init?.headers).toMatchObject({
      'user-agent': expect.stringContaining('AI-Pulse-Scout'),
      accept: expect.stringContaining('application/rss+xml'),
      'accept-language': 'en-US,en;q=0.9',
    });
    expect(parseString).toHaveBeenCalledOnce();
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
  });

  it('retries once on 429 before succeeding', async () => {
    const source = makeSource();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Feed</title>
        <item><title>Post 1</title><link>https://example.com/post-1</link><pubDate>Fri, 27 Jun 2026 00:00:00 GMT</pubDate><description>Hello</description></item>
        </channel></rss>`,
        { status: 200, headers: { 'content-type': 'application/rss+xml' } },
      ));
    const parseString = vi.fn(async () => ({
      items: [
        {
          title: 'Post 1',
          link: 'https://example.com/post-1',
          pubDate: 'Fri, 27 Jun 2026 00:00:00 GMT',
          content: 'Hello',
          contentSnippet: 'Hello',
        },
      ],
    }));
    const sleep = vi.fn(async () => undefined);

    const result = await fetchRssSource(source, new Date('2026-06-26T00:00:00.000Z'), new Date('2026-06-28T00:00:00.000Z'), {
      fetchImpl,
      parser: { parseString } as Pick<Parser, 'parseString'>,
      sleep,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
  });

  it('sanitizes malformed xml before parsing', async () => {
    const source = makeSource();
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Feed</title>
      <item><title>AT&T launch</title><link>https://example.com/post-1</link><pubDate>Fri, 27 Jun 2026 00:00:00 GMT</pubDate><description>A & B</description></item>
      </channel></rss>`;
    const fetchImpl = vi.fn(async () => new Response(malformedXml, { status: 200 }));
    const parseString = vi.fn(async (xml: string) => {
      expect(xml).toContain('AT&amp;T launch');
      expect(xml).toContain('A &amp; B');
      return {
        items: [
          {
            title: 'AT&T launch',
            link: 'https://example.com/post-1',
            pubDate: 'Fri, 27 Jun 2026 00:00:00 GMT',
            content: 'A & B',
            contentSnippet: 'A & B',
          },
        ],
      };
    });

    const result = await fetchRssSource(source, new Date('2026-06-26T00:00:00.000Z'), new Date('2026-06-28T00:00:00.000Z'), {
      fetchImpl,
      parser: { parseString } as Pick<Parser, 'parseString'>,
      sleep: vi.fn(),
    });

    expect(parseString).toHaveBeenCalledOnce();
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
  });
});
