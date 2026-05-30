import { describe, expect, it } from 'vitest';
import { normalizeWebpageItem } from '../../../src/adapters/webpage/normalizeWebpageItem';
import type { SourceConfig } from '../../../src/types/config';

const source: SourceConfig = {
  name: 'Web Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/blog',
  type: 'webpage',
  enabled: true,
};

describe('normalizeWebpageItem', () => {
  it('creates article_full items with webpage extraction metadata', () => {
    const item = normalizeWebpageItem({
      source,
      itemUrl: 'https://example.com/post-1',
      canonicalUrl: 'https://example.com/post-1',
      title: 'Post 1',
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
      content: 'Body',
      summaryMaterial: 'Body',
      extractionLevel: 'article_full',
      candidateOrigin: 'entry_page_direct_article',
      degradeReason: null,
    });

    expect(item.rawMetadata).toMatchObject({
      adapterType: 'webpage',
      extractionLevel: 'article_full',
      candidateOrigin: 'entry_page_direct_article',
    });
  });

  it('creates link_only items with fallback timestamp and degrade reason', () => {
    const item = normalizeWebpageItem({
      source,
      itemUrl: 'https://example.com/post-2',
      canonicalUrl: 'https://example.com/post-2',
      title: 'Post 2',
      publishedAt: null,
      publishedAtConfidence: 'fallback_discovered_at',
      content: '',
      summaryMaterial: '',
      extractionLevel: 'link_only',
      candidateOrigin: 'listing_page_candidate',
      degradeReason: 'content_extraction_failed',
    });

    expect(item.rawMetadata).toMatchObject({
      extractionLevel: 'link_only',
      degradeReason: 'content_extraction_failed',
    });
  });
});
