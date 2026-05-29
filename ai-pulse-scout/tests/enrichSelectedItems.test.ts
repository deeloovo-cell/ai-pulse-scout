import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NormalizedItem } from '../src/types/item.js';

const enrichKeyInsightsMock = vi.fn(async (items: NormalizedItem[]) =>
  items.map((item) => ({ ...item, key_insight: `llm:${item.id}` })),
);

vi.mock('../src/insights/analyzeKeyInsights.js', () => ({
  enrichKeyInsights: enrichKeyInsightsMock,
}));

function makeItem(index: number): NormalizedItem {
  return {
    id: `item-${index}`,
    title: `item-${index}`,
    primary_topic: 'AI News Roundup',
    published_at: new Date('2026-05-29T09:00:00.000Z'),
    fetched_at: new Date('2026-05-29T09:01:00.000Z'),
    item_url: `https://example.com/${index}`,
    source_name: 'Test',
    content_text: `body ${index}`,
    summary: `summary ${index}`,
    tags: [],
    rawMetadata: {},
  } as any;
}

describe('enrichSelectedItems', () => {
  beforeEach(() => {
    enrichKeyInsightsMock.mockClear();
  });

  it('only enriches the first 50 items and still returns all items', async () => {
    const { enrichSelectedItems } = await import('../src/insights/enrichSelectedItems.js');
    const items = Array.from({ length: 60 }, (_, i) => makeItem(i + 1));

    const result = await enrichSelectedItems(items, 50);

    expect(enrichKeyInsightsMock).toHaveBeenCalledTimes(1);
    expect(enrichKeyInsightsMock.mock.calls[0]?.[0]).toHaveLength(50);
    expect(result).toHaveLength(60);
    expect(result[0]?.key_insight).toBe('llm:item-1');
    expect(result[55]?.key_insight).toBeUndefined();
  });
});
