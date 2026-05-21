import { describe, it, expect } from 'vitest';
import { dedupeItems } from '../src/filtering/dedupeItems.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'test-id',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com',
    item_url: 'https://example.com/article-1',
    title: 'Test Article',
    published_at: new Date('2026-05-20T10:00:00Z'),
    fetched_at: new Date(),
    author: 'Author',
    content_text: 'Some content here about AI and agents',
    summary: 'Short summary',
    tags: [],
    content_type: 'article',
    fingerprint: 'abc123def456abcd',
    relevance_scores: { ai_engineering: 0.5, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0.3, aac_relevance: 0, overall: 0.4 },
    decision: 'pending',
    decision_reason: '',
    ...overrides,
  };
}

describe('dedupeItems', () => {
  it('passes items not in ledger', () => {
    const items = [makeItem()];
    const ledger = new Set<string>();
    expect(dedupeItems(items, ledger)).toHaveLength(1);
  });

  it('removes item whose fingerprint is in ledger', () => {
    const item = makeItem({ fingerprint: 'aaaabbbbccccdddd' });
    const ledger = new Set(['aaaabbbbccccdddd']);
    expect(dedupeItems([item], ledger)).toHaveLength(0);
  });

  it('removes item whose URL is in ledger', () => {
    const item = makeItem({ item_url: 'https://example.com/known' });
    const ledger = new Set(['https://example.com/known']);
    expect(dedupeItems([item], ledger)).toHaveLength(0);
  });

  it('deduplicates within the batch by fingerprint', () => {
    const item1 = makeItem({ fingerprint: 'same1234same1234', id: 'id-1' });
    const item2 = makeItem({ fingerprint: 'same1234same1234', id: 'id-2' });
    const ledger = new Set<string>();
    expect(dedupeItems([item1, item2], ledger)).toHaveLength(1);
  });

  it('deduplicates within the batch by URL', () => {
    const item1 = makeItem({ item_url: 'https://example.com/dup', fingerprint: 'fp1', id: 'id-1' });
    const item2 = makeItem({ item_url: 'https://example.com/dup', fingerprint: 'fp2', id: 'id-2' });
    const ledger = new Set<string>();
    expect(dedupeItems([item1, item2], ledger)).toHaveLength(1);
  });

  it('keeps items with different fingerprints and URLs', () => {
    const item1 = makeItem({ item_url: 'https://example.com/a', fingerprint: 'fp1', id: 'id-1' });
    const item2 = makeItem({ item_url: 'https://example.com/b', fingerprint: 'fp2', id: 'id-2' });
    const ledger = new Set<string>();
    expect(dedupeItems([item1, item2], ledger)).toHaveLength(2);
  });
});
