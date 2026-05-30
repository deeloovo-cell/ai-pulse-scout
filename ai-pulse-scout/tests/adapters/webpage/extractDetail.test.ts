import { describe, expect, it } from 'vitest';
import { extractDetail } from '../../../src/adapters/webpage/extractDetail';

describe('extractDetail', () => {
  it('extracts title, canonical, exact timestamp, and article text', () => {
    const html = `
      <html><head>
        <title>Test Article</title>
        <link rel="canonical" href="https://example.com/post-1" />
        <meta property="article:published_time" content="2026-05-26T00:00:00Z" />
      </head><body>
        <article><p>Paragraph one.</p><p>Paragraph two.</p></article>
      </body></html>
    `;

    expect(extractDetail('https://example.com/post-1', html)).toMatchObject({
      title: 'Test Article',
      canonicalUrl: 'https://example.com/post-1',
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
    });
  });

  it('falls back to derived or missing content states safely', () => {
    const html = `
      <html><head><title>Weak Article</title></head><body>
        <main><p>Short body.</p></main>
      </body></html>
    `;

    expect(extractDetail('https://example.com/post-2', html)).toMatchObject({
      title: 'Weak Article',
      canonicalUrl: 'https://example.com/post-2',
      publishedAt: null,
    });
  });
});
