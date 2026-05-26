import { describe, expect, it } from 'vitest';
import { renderHtmlEmail } from '../../src/render/renderHtmlEmail';
import type { NormalizedItem } from '../../src/types/item';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  const now = new Date('2026-05-26T00:00:00.000Z');

  return {
    id: 'item-1',
    source_name: 'Web Source',
    source_category: 'frontier-model-labs',
    source_url: 'https://example.com/blog',
    item_url: 'https://example.com/blog/post-1',
    title: 'Recovered article link',
    published_at: null,
    fetched_at: now,
    author: '',
    content_text: '',
    summary: '',
    tags: [],
    content_type: 'article',
    fingerprint: 'fp-1',
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'include',
    decision_reason: 'included',
    primary_topic: 'AI News Roundup',
    rawMetadata: {
      extractionLevel: 'link_only',
      candidateOrigin: 'listing_page_candidate',
      degradeReason: 'detail_fetch_failed',
      publishedAtConfidence: 'fallback_discovered_at',
    },
    sourceType: 'webpage',
    sourceUrl: 'https://example.com/blog',
    sourceName: 'Web Source',
    itemUrl: 'https://example.com/blog/post-1',
    canonicalUrl: 'https://example.com/blog/post-1',
    publishedAt: null,
    publishedAtConfidence: 'fallback_discovered_at',
    discoveredAt: now.toISOString(),
    content: '',
    summaryMaterial: '',
    stableIdentity: 'fp-1',
    topicHints: ['AI News Roundup'],
    ...overrides,
  };
}

describe('renderHtmlEmail webpage quality rendering', () => {
  it('renders degraded webpage items safely without exposing internal metadata labels', () => {
    const html = renderHtmlEmail({
      items: [makeItem()],
      date: new Date('2026-05-26T00:00:00.000Z'),
      subjectTemplate: 'AI Pulse Scout - {date}',
    });

    expect(html).toContain('Recovered article link');
    expect(html).toContain('https://example.com/blog/post-1');
    expect(html).toContain('Read source');
    expect(html).not.toContain('link_only');
    expect(html).not.toContain('detail_fetch_failed');
    expect(html).not.toContain('listing_page_candidate');
  });
});
