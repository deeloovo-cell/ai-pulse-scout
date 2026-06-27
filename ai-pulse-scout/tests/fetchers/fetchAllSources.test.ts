import { describe, expect, it, vi } from 'vitest';
import { fetchAllSources } from '../../src/fetchers/rssFetcher.js';
import type { SourceConfig } from '../../src/types/config.js';

function makeSource(name: string, url: string): SourceConfig {
  return {
    name,
    category: 'community',
    url,
    type: 'rss',
    enabled: true,
  };
}

describe('fetchAllSources', () => {
  it('serializes high-risk throttled community feeds instead of starting them all at once', async () => {
    const sources = [
      makeSource('Reddit A', 'https://www.reddit.com/r/A/.rss'),
      makeSource('Hacker News', 'https://hnrss.org/frontpage'),
      makeSource('Reddit B', 'https://www.reddit.com/r/B/.rss'),
    ];

    let inFlight = 0;
    let maxConcurrent = 0;
    const release: Array<() => void> = [];

    const fetchImpl = vi.fn(async () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise<void>((resolve) => release.push(resolve));
      inFlight -= 1;
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Feed</title>
        <item><title>Post 1</title><link>https://example.com/post-1</link><pubDate>Fri, 27 Jun 2026 00:00:00 GMT</pubDate><description>Hello</description></item>
        </channel></rss>`,
        { status: 200, headers: { 'content-type': 'application/rss+xml' } },
      );
    });

    const promise = fetchAllSources(sources, new Date('2026-06-26T00:00:00.000Z'), new Date('2026-06-28T00:00:00.000Z'), {
      fetchImpl,
      sleep: vi.fn(async () => undefined),
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(maxConcurrent).toBe(1);

    for (let i = 0; i < sources.length; i += 1) {
      while (release.length === 0) {
        await Promise.resolve();
      }
      const next = release.shift();
      expect(next).toBeTypeOf('function');
      next?.();
      await Promise.resolve();
      await Promise.resolve();
      expect(maxConcurrent).toBe(1);
    }

    const results = await promise;
    expect(results).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
