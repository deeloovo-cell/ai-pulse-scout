import { afterEach, describe, expect, it, vi } from 'vitest';
import * as chatCompletions from '../src/insights/chatCompletions.js';
import { requestChatCompletion } from '../src/insights/chatCompletions.js';
import { generateExecutiveBrief } from '../src/insights/generateExecutiveBrief.js';
import { enrichKeyInsights } from '../src/insights/analyzeKeyInsights.js';
import type { NormalizedItem } from '../src/types/item.js';

const client = {
  apiKey: 'test-key',
  model: 'deepseek-v3.2',
  endpoint: 'https://example.com/chat/completions',
};

function makeInsightItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'i1',
    source_name: 'Source',
    source_category: 'research',
    source_url: 'https://example.com/feed',
    item_url: 'https://example.com/item',
    title: 'AI item',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'This is about llm inference and multimodal models.',
    summary: 'This is about llm inference and multimodal models.',
    tags: [],
    content_type: 'research',
    fingerprint: 'fp-i1',
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

describe('requestChatCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('aborts and throws a timeout error when fetch stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
        });
      }),
    );

    const expectation = expect(
      requestChatCompletion(client, [{ role: 'user', content: 'hello' }], 10, 50),
    ).rejects.toThrow('timed out');

    await vi.advanceTimersByTimeAsync(60);
    await expectation;
  });

  it('returns message content when fetch succeeds before timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      }),
    );

    await expect(
      requestChatCompletion(client, [{ role: 'user', content: 'hello' }], 10, 1000),
    ).resolves.toBe('ok');
  });
});

describe('LLM fallback behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns fallback executive brief when chat completion times out', async () => {
    vi.spyOn(chatCompletions, 'requestChatCompletion').mockImplementation(async () => {
      throw new Error('LLM request timed out after 50ms');
    });

    const brief = await generateExecutiveBrief([makeInsightItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://example.com',
      model: 'deepseek-v3.2',
    });

    expect(brief).not.toBeNull();
    expect(brief?.suggested_action).toContain('Assign a short technical review');
  });

  it('returns fallback key insights when chat completion times out', async () => {
    vi.spyOn(chatCompletions, 'requestChatCompletion').mockImplementation(async () => {
      throw new Error('LLM request timed out after 50ms');
    });

    const items = await enrichKeyInsights([makeInsightItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://example.com',
      model: 'deepseek-v3.2',
      fetchFullPosts: false,
    });

    expect(items[0]?.key_insight).toBeTruthy();
    expect(items[0]?.executive_insight).toBeTruthy();
  });
});
