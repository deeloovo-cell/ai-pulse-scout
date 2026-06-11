import { describe, expect, it } from 'vitest';
import { prepareDigestItems } from '../src/filtering/prepareDigestItems.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(index: number, overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  const url = `https://source-${index % 8}.example.com/item-${index}`;
  return {
    id: `item-${index}`,
    source_name: `Source ${index % 8}`,
    source_category: 'blog',
    source_url: `https://source-${index % 8}.example.com/feed`,
    item_url: url,
    title: `General industry update ${index}`,
    published_at: new Date(Date.UTC(2026, 5, 10, 0, index)),
    fetched_at: new Date(Date.UTC(2026, 5, 10, 0, index, 1)),
    author: '',
    content_text: 'No keyword-based relevance requirement.',
    summary: 'General update.',
    tags: [],
    content_type: 'article',
    fingerprint: url,
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
    ...overrides,
  };
}

describe('prepareDigestItems', () => {
  it('deduplicates, orders by recency, and caps without keyword filtering', () => {
    const items = Array.from({ length: 62 }, (_, index) => makeItem(index));
    items.push(makeItem(100, {
      id: 'duplicate',
      item_url: items[61].item_url,
      fingerprint: items[61].fingerprint,
    }));

    const result = prepareDigestItems(items, {
      max_items: 60,
      collection_window_hours: 24,
      safety_buffer_hours: 0,
    });

    expect(result.deduped).toHaveLength(62);
    expect(result.ordered[0]?.id).toBe('item-61');
    expect(result.selected).toHaveLength(60);
    expect(result.selected.every((item) => item.decision === 'include')).toBe(true);
  });
});
