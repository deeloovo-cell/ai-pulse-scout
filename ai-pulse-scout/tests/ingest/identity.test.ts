import { describe, expect, it } from 'vitest';
import { buildStableIdentity } from '../../src/ingest/identity';

describe('buildStableIdentity', () => {
  it('prefers canonical URL when available', () => {
    expect(
      buildStableIdentity({
        canonicalUrl: 'https://example.com/post-1?ref=home',
        itemUrl: 'https://example.com/post-1?utm_source=rss',
        sourceUrl: 'https://example.com/blog',
        title: 'Post 1',
        publishedAt: '2026-05-25T00:00:00.000Z',
      }),
    ).toBe('url:https://example.com/post-1');
  });

  it('falls back to source-specific IDs when canonical URL is missing', () => {
    expect(
      buildStableIdentity({
        itemUrl: 'https://www.youtube.com/watch?v=abc123',
        sourceUrl: 'https://www.youtube.com/@Example',
        title: 'Video 1',
        publishedAt: '2026-05-25T00:00:00.000Z',
        sourceSpecificId: 'youtube:abc123',
      }),
    ).toBe('source-id:youtube:abc123');
  });
});
