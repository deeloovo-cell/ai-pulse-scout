import { describe, expect, it, vi } from 'vitest';
import type { NormalizedItem } from '../../src/types/item.js';

vi.mock('../../src/insights/chatCompletions.js', () => ({
  resolveLlmClient: () => ({ provider: 'test' }),
  requestChatCompletion: vi.fn(async () => JSON.stringify({
    why_it_matters: '中文价值判断',
    growth_lever: 'Efficiency',
    applies_to: ['R&D'],
    action: 'Monitor',
    manufacturing_relevance: 'High',
  })),
}));

function makeItem(): NormalizedItem {
  return {
    id: 'item-1',
    title: 'Test item',
    source_name: 'Source',
    source_category: 'webpage',
    source_url: 'https://example.com',
    item_url: 'https://example.com/item',
    published_at: new Date('2026-05-30T00:00:00.000Z'),
    fetched_at: new Date('2026-05-30T00:00:00.000Z'),
    author: '',
    content_text: 'Body',
    summary: 'Summary',
    tags: [],
    content_type: 'article',
    fingerprint: 'x',
    relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
  } as any;
}

describe('enrichSingleItem', () => {
  it('returns enriched item insight data for one item', async () => {
    const { enrichSingleItem } = await import('../../src/insights/analyzeKeyInsights.js');
    const result = await enrichSingleItem(makeItem(), { fetchFullPosts: false });
    expect(result.key_insight).toBe('中文价值判断');
  });
});
