import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  extractArxivCategoryFromSourceUrl,
  parseArxivApiResponse,
  fetchArxivApiEntries,
} from '../../src/adapters/arxivApi';

describe('extractArxivCategoryFromSourceUrl', () => {
  it('extracts category names from arxiv rss source urls', () => {
    expect(extractArxivCategoryFromSourceUrl('https://arxiv.org/rss/cs.AI')).toBe('cs.AI');
    expect(extractArxivCategoryFromSourceUrl('https://arxiv.org/rss/stat.ML')).toBe('stat.ML');
  });
});

describe('parseArxivApiResponse', () => {
  it('parses arxiv atom entries into structured records', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>http://arxiv.org/abs/2605.99999v1</id>
        <updated>2026-05-31T03:00:00Z</updated>
        <published>2026-05-31T02:30:00Z</published>
        <title>API Paper Title</title>
        <summary>Paper summary text.</summary>
        <author><name>Author One</name></author>
        <category term="cs.AI" />
        <link href="http://arxiv.org/abs/2605.99999v1" rel="alternate" type="text/html" />
      </entry>
    </feed>`;

    const entries = parseArxivApiResponse(xml);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: '2605.99999v1',
      title: 'API Paper Title',
      summary: 'Paper summary text.',
      primaryCategory: 'cs.AI',
      canonicalUrl: 'https://arxiv.org/abs/2605.99999v1',
    });
    expect(entries[0].publishedAt.toISOString()).toBe('2026-05-31T02:30:00.000Z');
  });
});

describe('fetchArxivApiEntries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('filters api entries to the requested window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>http://arxiv.org/abs/2605.10000v1</id>
          <updated>2026-05-31T03:00:00Z</updated>
          <published>2026-05-31T02:30:00Z</published>
          <title>Inside Window</title>
          <summary>Inside.</summary>
          <author><name>A</name></author>
          <category term="cs.AI" />
        </entry>
        <entry>
          <id>http://arxiv.org/abs/2605.10001v1</id>
          <updated>2026-05-30T03:00:00Z</updated>
          <published>2026-05-30T02:30:00Z</published>
          <title>Outside Window</title>
          <summary>Outside.</summary>
          <author><name>B</name></author>
          <category term="cs.AI" />
        </entry>
      </feed>`, { status: 200 })) as any,
    );

    const entries = await fetchArxivApiEntries(
      'cs.AI',
      new Date('2026-05-31T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
    );

    expect(entries.map((entry) => entry.title)).toEqual(['Inside Window']);
  });
});
