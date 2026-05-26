import { describe, expect, it } from 'vitest';
import { extractRecentArticleLinksFromHtml } from '../../src/adapters/genericWebAdapter';

describe('GenericWebAdapter', () => {
  it('extracts likely article links from an index page', () => {
    const html = `
      <html>
        <body>
          <a href="/blog/post-1">Post 1</a>
          <a href="/about">About</a>
          <a href="https://example.com/news/post-2">Post 2</a>
        </body>
      </html>
    `;

    expect(extractRecentArticleLinksFromHtml('https://example.com', html)).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/news/post-2',
    ]);
  });
});
