import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichKeyInsights } from '../src/insights/analyzeKeyInsights.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'test-id',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com',
    item_url: 'https://example.com/article',
    title: 'Major AI Breakthrough Released',
    published_at: new Date('2026-05-20T10:00:00Z'),
    fetched_at: new Date(),
    author: 'AI Researcher',
    content_text: 'This article describes a new agentic AI framework with industrial applications.',
    summary: 'New agentic AI framework for industrial use.',
    tags: [],
    content_type: 'article',
    fingerprint: 'abc123def456abcd',
    relevance_scores: {
      ai_engineering: 0.8,
      industrial_ai: 0.3,
      cad_cae_cam: 0,
      executive_signal: 0.5,
      aac_relevance: 0.1,
      overall: 0.6,
    },
    decision: 'include',
    decision_reason: 'score=0.60',
    ...overrides,
  };
}

describe('enrichKeyInsights', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers DEEPSEEK env vars and falls back to GLM env vars', async () => {
    const originalEnv = { ...process.env };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'DeepSeek-compatible insight.',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    process.env.DEEPSEEK_API_KEY = 'deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';
    process.env.DEEPSEEK_MODEL = 'deepseek-v3.2';
    delete process.env.GLM_API_KEY;
    delete process.env.GLM_BASE_URL;
    delete process.env.GLM_MODEL;

    const [deepseekItem] = await enrichKeyInsights([makeItem()], {
      fetchFullPosts: false,
    });

    expect(deepseekItem.key_insight).toBe('DeepSeek-compatible insight.');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://aigw.aac.tech/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"deepseek-v3.2"'),
      }),
    );

    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    process.env.GLM_API_KEY = 'glm-fallback-key';
    process.env.GLM_BASE_URL = 'https://fallback.example/v1';
    process.env.GLM_MODEL = 'fallback-model';

    const [fallbackItem] = await enrichKeyInsights([makeItem()], {
      fetchFullPosts: false,
    });

    expect(fallbackItem.key_insight).toBe('DeepSeek-compatible insight.');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://fallback.example/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"fallback-model"'),
      }),
    );

    process.env = originalEnv;
  });

  it('returns original items when no API key is configured', async () => {
    const items = [makeItem()];

    await expect(enrichKeyInsights(items, { apiKey: '' })).resolves.toEqual(items);
  });

  it('adds key insight from DeepSeek chat completion response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'The real insight is that production agent cost control is now an architecture concern.',
            },
          },
        ],
      }),
    });
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    const [item] = await enrichKeyInsights([makeItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://aigw.aac.tech/v1',
      model: 'deepseek-v3.2',
      fetchFullPosts: false,
    });

    expect(item.key_insight).toBe('The real insight is that production agent cost control is now an architecture concern.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://aigw.aac.tech/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"model":"deepseek-v3.2"'),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages).toHaveLength(2);
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(800);
    expect(body.messages[1].content).toContain('100 words or fewer');
  });

  it('falls back to original item when DeepSeek request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'bad key' } }),
      }),
    );

    const original = makeItem();
    const [item] = await enrichKeyInsights([original], {
      apiKey: 'test-key',
      fetchFullPosts: false,
    });

    expect(item).toEqual(original);
  });
});
