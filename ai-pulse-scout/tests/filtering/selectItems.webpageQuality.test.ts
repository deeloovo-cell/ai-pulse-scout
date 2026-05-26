import { describe, expect, it } from 'vitest';
import { selectItems } from '../../src/filtering/selectItems';
import type { NormalizedItem } from '../../src/types/item';

function makeItem(overrides: Partial<NormalizedItem>): NormalizedItem {
  const now = new Date('2026-05-26T00:00:00.000Z');
  return {
    id: 'id',
    source_name: 'Web Source',
    source_category: 'frontier-model-labs',
    source_url: 'https://example.com/blog',
    item_url: 'https://example.com/post',
    title: 'Title',
    published_at: now,
    fetched_at: now,
    author: '',
    content_text: 'Body',
    summary: 'Body',
    tags: [],
    content_type: 'article',
    fingerprint: 'fp',
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    sourceType: 'webpage',
    sourceUrl: 'https://example.com/blog',
    sourceName: 'Web Source',
    itemUrl: 'https://example.com/post',
    canonicalUrl: 'https://example.com/post',
    publishedAt: now.toISOString(),
    publishedAtConfidence: 'exact',
    discoveredAt: now.toISOString(),
    content: 'Body',
    summaryMaterial: 'Body',
    stableIdentity: 'fp',
    topicHints: ['AI News Roundup'],
    ...overrides,
  };
}

describe('selectItems webpage quality weighting', () => {
  it('prefers article_full over link_only when timestamps are otherwise similar', () => {
    const articleFull = makeItem({
      id: 'full',
      item_url: 'https://example.com/post-1',
      itemUrl: 'https://example.com/post-1',
      canonicalUrl: 'https://example.com/post-1',
      fingerprint: 'fp-full',
      stableIdentity: 'fp-full',
      rawMetadata: { extractionLevel: 'article_full' },
    });
    const linkOnly = makeItem({
      id: 'link',
      item_url: 'https://example.com/post-2',
      itemUrl: 'https://example.com/post-2',
      canonicalUrl: 'https://example.com/post-2',
      fingerprint: 'fp-link',
      stableIdentity: 'fp-link',
      rawMetadata: { extractionLevel: 'link_only' },
    });

    const selected = selectItems([linkOnly, articleFull], {
      max_items: 10,
      min_items: 1,
      collection_window_hours: 24,
      safety_buffer_hours: 0,
    });

    expect(selected[0].id).toBe('full');
  });
});
