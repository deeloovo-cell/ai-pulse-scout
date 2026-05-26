import { describe, expect, it } from 'vitest';
import { extractCandidates } from '../../../src/adapters/webpage/extractCandidates';

describe('extractCandidates', () => {
  it('prefers article-like links and excludes utility pages', () => {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="/blog/post-1">Post 1</a>
        <a href="/news/post-2">Post 2</a>
        <a href="/privacy">Privacy</a>
      </body></html>
    `;

    expect(extractCandidates('https://example.com', html)).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/news/post-2',
    ]);
  });

  it('deduplicates and caps the candidate list', () => {
    const html = `
      <html><body>
        <a href="/blog/post-1">One</a>
        <a href="/blog/post-1">One again</a>
        <a href="/blog/post-2">Two</a>
        <a href="/blog/post-3">Three</a>
      </body></html>
    `;

    expect(extractCandidates('https://example.com', html, { maxCandidates: 2 })).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/blog/post-2',
    ]);
  });
});
