import { describe, expect, it, vi } from 'vitest';
import type { NormalizedItem } from '../src/types/item.js';

const enrichKeyInsightsMock = vi.fn(async (items: NormalizedItem[]) =>
  items.map((item) => ({
    ...item,
    key_insight: `insight:${item.id}`,
  })),
);

vi.mock('../src/insights/analyzeKeyInsights.js', () => ({
  enrichKeyInsights: enrichKeyInsightsMock,
}));

function makeItem(index: number): NormalizedItem {
  return {
    sourceType: 'rss',
    sourceUrl: 'https://example.com/feed.xml',
    sourceName: 'Test Source',
    itemUrl: `https://example.com/post-${index}`,
    canonicalUrl: `https://example.com/post-${index}`,
    title: `AI item ${index}`,
    publishedAt: `2026-05-29T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
    publishedAtConfidence: 'exact',
    discoveredAt: `2026-05-29T${String(index % 24).padStart(2, '0')}:01:00.000Z`,
    content: `AI content ${index}`,
    summaryMaterial: `AI content ${index}`,
    stableIdentity: `stable-${index}`,
    topicHints: ['AI News Roundup'],
    rawMetadata: {},
    id: `item-${index}`,
    source_name: 'Test Source',
    source_category: 'research',
    source_url: 'https://example.com/feed.xml',
    item_url: `https://example.com/post-${index}`,
    published_at: new Date(`2026-05-29T${String(index % 24).padStart(2, '0')}:00:00.000Z`),
    fetched_at: new Date(`2026-05-29T${String(index % 24).padStart(2, '0')}:01:00.000Z`),
    author: '',
    content_text: `AI content ${index}`,
    summary: `AI content ${index}`,
    tags: [],
    content_type: 'research',
    fingerprint: `fp-${index}`,
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
  };
}

describe('insight enrichment cap', () => {
  it('enriches only the first 100 selected items but still returns all selected items', async () => {
    const { enrichSelectedItems } = await import('../src/insights/enrichSelectedItems.js');
    const items = Array.from({ length: 110 }, (_, index) => makeItem(index + 1));

    const result = await enrichSelectedItems(items);

    expect(enrichKeyInsightsMock).toHaveBeenCalledTimes(1);
    expect(enrichKeyInsightsMock.mock.calls[0]?.[0]).toHaveLength(100);
    expect(result).toHaveLength(110);
    expect(result[0]?.key_insight).toBe('insight:item-1');
    expect(result[99]?.key_insight).toBe('insight:item-100');
    expect(result[100]?.key_insight).toBeUndefined();
  });

  it('enriches all selected items when count is below the default cap', async () => {
    const { enrichSelectedItems } = await import('../src/insights/enrichSelectedItems.js');
    const items = Array.from({ length: 5 }, (_, index) => makeItem(index + 1));

    const result = await enrichSelectedItems(items);

    expect(enrichKeyInsightsMock.mock.calls.at(-1)?.[0]).toHaveLength(5);
    expect(result).toHaveLength(5);
  });
});
