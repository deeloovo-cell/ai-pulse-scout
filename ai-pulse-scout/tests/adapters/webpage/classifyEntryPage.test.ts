import { describe, expect, it } from 'vitest';
import { classifyEntryPage } from '../../../src/adapters/webpage/classifyEntryPage';

describe('classifyEntryPage', () => {
  it('classifies feed-capable pages from alternate feed links', () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/rss.xml" />
      </head></html>
    `;

    expect(classifyEntryPage('https://example.com/blog', html)).toBe('feed_page');
  });

  it('classifies direct article pages from article metadata', () => {
    const html = `
      <html><head>
        <meta property="article:published_time" content="2026-05-26T00:00:00Z" />
      </head><body><article><h1>Title</h1><p>Body</p></article></body></html>
    `;

    expect(classifyEntryPage('https://example.com/post-1', html)).toBe('article_page');
  });

  it('classifies listing pages from repeated article-like links', () => {
    const html = `
      <html><body>
        <a href="/blog/post-1">Post 1</a>
        <a href="/blog/post-2">Post 2</a>
        <a href="/blog/post-3">Post 3</a>
      </body></html>
    `;

    expect(classifyEntryPage('https://example.com/blog', html)).toBe('listing_page');
  });

  it('classifies weak pages as unknown when no useful signals exist', () => {
    const html = `<html><body><a href="/about">About</a></body></html>`;
    expect(classifyEntryPage('https://example.com', html)).toBe('unknown_page');
  });
});
