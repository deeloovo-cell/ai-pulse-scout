import { describe, expect, it } from 'vitest';
import { isAiRelevant } from '../src/filtering/isAiRelevant.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'item-1',
    source_name: 'Test Source',
    source_category: 'research',
    source_url: 'https://example.com/feed',
    item_url: 'https://example.com/post',
    title: 'Test title',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'Test content',
    summary: 'Test summary',
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
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

describe('isAiRelevant', () => {
  it('accepts clearly AI-related model/system items', () => {
    const item = makeItem({
      title: 'Open-source agent framework for LLM workflow orchestration',
      summary: 'Covers agent runtime design, model routing, tool use, and inference orchestration.',
    });

    expect(isAiRelevant(item)).toBe(true);
  });

  it('accepts clearly AI-related research items', () => {
    const item = makeItem({
      content_type: 'research',
      title: 'Diffusion policy for robotic manipulation',
      summary: 'A machine learning approach for robot control trained on multimodal data.',
    });

    expect(isAiRelevant(item)).toBe(true);
  });

  it('rejects generic software items with no AI angle', () => {
    const item = makeItem({
      title: 'How we improved CI pipeline stability',
      summary: 'A post about flaky tests, build caching, and release automation.',
    });

    expect(isAiRelevant(item)).toBe(false);
  });

  it('rejects broad policy/social items without specific AI linkage', () => {
    const item = makeItem({
      title: 'Computers and society in modern workplaces',
      summary: 'General discussion of technology and workplace change with no AI-specific details.',
    });

    expect(isAiRelevant(item)).toBe(false);
  });
});
