import { describe, expect, it } from 'vitest';
import { selectItems } from '../src/filtering/selectItems.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'test-id',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com',
    item_url: 'https://example.com/article',
    title: 'Test Article',
    published_at: new Date('2026-05-20T10:00:00Z'),
    fetched_at: new Date('2026-05-20T10:05:00Z'),
    author: '',
    content_text: 'Test content',
    summary: 'Test summary',
    tags: [],
    content_type: 'article',
    fingerprint: 'fingerprint',
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
    ...overrides,
  };
}

describe('selectItems', () => {
  it('selects recent items by published time without score filtering', () => {
    const items = [
      makeItem({ id: 'old', title: 'Old', published_at: new Date('2026-05-20T08:00:00Z') }),
      makeItem({ id: 'new', title: 'New', published_at: new Date('2026-05-20T12:00:00Z') }),
    ];

    const selected = selectItems(items, {
      max_items: 2,
      collection_window_hours: 24,
      safety_buffer_hours: 0,
    });

    expect(selected.map((item) => item.id)).toEqual(['new', 'old']);
    expect(selected[0].decision_reason).toBe('included: updated in collection window');
  });

  it('caps selected items at max_items', () => {
    const items = [
      makeItem({ id: 'a', published_at: new Date('2026-05-20T12:00:00Z') }),
      makeItem({ id: 'b', published_at: new Date('2026-05-20T11:00:00Z') }),
      makeItem({ id: 'c', published_at: new Date('2026-05-20T10:00:00Z') }),
    ];

    const selected = selectItems(items, {
      max_items: 2,
      collection_window_hours: 24,
      safety_buffer_hours: 0,
    });

    expect(selected.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
