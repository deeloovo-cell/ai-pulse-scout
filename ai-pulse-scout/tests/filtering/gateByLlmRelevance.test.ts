import { describe, expect, it } from 'vitest';
import { gateByLlmRelevance } from '../../src/filtering/gateByLlmRelevance.js';
import type { NormalizedItem } from '../../src/types/item.js';
import type { ManufacturingRelevance } from '../../src/types/executive.js';

function makeItem(id: string, relevance?: ManufacturingRelevance): NormalizedItem {
  return {
    id,
    title: id,
    primary_topic: 'AI News Roundup',
    published_at: new Date('2026-06-10T09:00:00.000Z'),
    fetched_at: new Date('2026-06-10T09:01:00.000Z'),
    item_url: `https://example.com/${id}`,
    source_name: 'Test',
    content_text: 'body',
    summary: 'summary',
    tags: [],
    rawMetadata: {},
    executive_insight: relevance
      ? {
          why_it_matters: 'matters',
          growth_lever: 'Efficiency',
          applies_to: ['R&D'],
          action: 'Monitor',
          manufacturing_relevance: relevance,
        }
      : undefined,
  } as unknown as NormalizedItem;
}

describe('gateByLlmRelevance', () => {
  it('drops items rated Low', () => {
    const result = gateByLlmRelevance([
      makeItem('high', 'High'),
      makeItem('low', 'Low'),
      makeItem('medium', 'Medium'),
    ]);

    expect(result.items.map((item) => item.id)).toEqual(['high', 'medium']);
    expect(result.kept).toBe(2);
    expect(result.dropped).toBe(1);
  });

  it('ranks High before Medium while preserving incoming order within tiers', () => {
    const result = gateByLlmRelevance([
      makeItem('medium-1', 'Medium'),
      makeItem('high-1', 'High'),
      makeItem('medium-2', 'Medium'),
      makeItem('high-2', 'High'),
    ]);

    expect(result.items.map((item) => item.id)).toEqual(['high-1', 'high-2', 'medium-1', 'medium-2']);
  });

  it('keeps items without a rating (fallback enrichment) and treats them as Medium', () => {
    const result = gateByLlmRelevance([
      makeItem('unrated'),
      makeItem('high', 'High'),
    ]);

    expect(result.items.map((item) => item.id)).toEqual(['high', 'unrated']);
    expect(result.dropped).toBe(0);
  });
});
