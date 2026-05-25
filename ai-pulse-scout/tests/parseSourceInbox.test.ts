import { describe, expect, it } from 'vitest';
import { parseSourceInbox } from '../src/inbox/parseSourceInbox.js';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';

describe('parseSourceInbox', () => {
  it('parses categorized sections in source-inbox markdown', () => {
    const markdown = `
## rss
- https://openai.com/news/rss.xml

## webpage
- https://openai.com/news/

## youtube
- https://www.youtube.com/@OpenAI
`;

    const result = parseSourceInbox(markdown);

    expect(result.sections.rss).toEqual(['https://openai.com/news/rss.xml']);
    expect(result.sections.webpage).toEqual(['https://openai.com/news/']);
    expect(result.sections.youtube).toEqual(['https://www.youtube.com/@OpenAI']);
  });

  it('preserves all URLs without flattening away category membership', () => {
    const markdown = `
## community
- https://news.ycombinator.com/

## papers
- https://arxiv.org/list/cs.AI/recent
`;

    const result = parseSourceInbox(markdown);

    expect(result.allUrls).toEqual([
      'https://news.ycombinator.com/',
      'https://arxiv.org/list/cs.AI/recent',
    ]);
    expect(result.categoryByUrl['https://news.ycombinator.com/']).toBe('community');
    expect(result.categoryByUrl['https://arxiv.org/list/cs.AI/recent']).toBe('papers');
  });

  it('extracts URLs from unicode bullet lists inside categorized sections', () => {
    const markdown = `
## rss
• https://example.com/feed.xml
`;

    const result = parseSourceInbox(markdown);

    expect(result.sections.rss).toEqual(['https://example.com/feed.xml']);
    expect(result.categoryByUrl['https://example.com/feed.xml']).toBe('rss');
  });
});

describe('buildSourceUniverse', () => {
  it('enriches parsed inbox entries with classification', () => {
    const markdown = `## youtube\n- https://www.youtube.com/@aiDotEngineer\n`;
    const universe = buildSourceUniverse(markdown);

    expect(universe[0]).toMatchObject({
      url: 'https://www.youtube.com/@aiDotEngineer',
      category: 'youtube',
      classification: {
        kind: 'youtube',
        strategy: 'youtube_channel_resolution',
      },
    });
  });
});
