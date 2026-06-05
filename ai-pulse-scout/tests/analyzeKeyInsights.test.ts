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

  it('uses DEEPSEEK env vars only and ignores legacy non-DeepSeek env vars', async () => {
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
    process.env.GLM_API_KEY = 'legacy-key';
    process.env.GLM_BASE_URL = 'https://legacy.example/v1';
    process.env.GLM_MODEL = 'legacy-model';

    const [fallbackItem] = await enrichKeyInsights([makeItem()], {
      fetchFullPosts: false,
    });

    expect(fallbackItem.key_insight).toBe('New agentic AI framework for industrial use.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    process.env = originalEnv;
  });

  it('attaches fallback key insight and executive insight when no API key is configured', async () => {
    const [item] = await enrichKeyInsights([makeItem()], { apiKey: '' });

    expect(item.key_insight).toBe('New agentic AI framework for industrial use.');
    expect(item.executive_insight).toEqual({
      why_it_matters: 'New agentic AI framework for industrial use.',
      growth_lever: 'Efficiency',
      applies_to: ['R&D'],
      action: 'Monitor',
      manufacturing_relevance: undefined,
      source_summary: '这条该来源的AI 主题更新主要讨论「Major AI Breakthrough Released」；当前先保留来源关键信息，建议点击查看完整细节。',
      business_domains: undefined,
    });
  });

  it('requests chinese source_summary and relevance fields from the chat completion prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"source_summary":"这条更新介绍了 agent 编排框架。","why_it_matters":"这说明生产级 agent 的成本控制已经变成架构问题。","growth_lever":"Efficiency","applies_to":["R&D"],"action":"Monitor","business_domains":["研发","供应链"]}',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [item] = await enrichKeyInsights([makeItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://aigw.aac.tech/v1',
      model: 'deepseek-v3.2',
      fetchFullPosts: false,
    });

    expect(item.key_insight).toBe('这说明生产级 agent 的成本控制已经变成架构问题。');
    expect(item.executive_insight?.source_summary).toBe('这条更新介绍了 agent 编排框架。');
    expect(item.executive_insight?.business_domains).toEqual(['研发', '供应链']);
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
    expect(body.max_tokens).toBe(900);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(body.messages[0].content).toContain('source_summary');
    expect(body.messages[0].content).toContain('business_domains');
    expect(body.messages[0].content).toContain('why_it_matters 是第二段');
    expect(body.messages[1].content).toContain('Analyze this item for the daily manufacturing AI digest.');
    expect(body.messages[1].content).toContain('Existing feed summary: New agentic AI framework for industrial use.');
  });

  it('uses a 20-second timeout for DeepSeek requests', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      async (_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        if (!(signal instanceof AbortSignal)) {
          throw new Error('missing abort signal');
        }

        return await new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const run = enrichKeyInsights([makeItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://aigw.aac.tech/v1',
      model: 'deepseek-v3.2',
      fetchFullPosts: false,
    });

    await vi.advanceTimersByTimeAsync(19_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_001);
    const [item] = await run;

    expect(item.key_insight).toBe('New agentic AI framework for industrial use.');
    vi.useRealTimers();
  });

  it('falls back to generated insight when DeepSeek request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'bad key' } }),
      }),
    );

    const [item] = await enrichKeyInsights([makeItem()], {
      apiKey: 'test-key',
      fetchFullPosts: false,
    });

    expect(item.key_insight).toBe('New agentic AI framework for industrial use.');
    expect(item.executive_insight).toEqual({
      why_it_matters: 'New agentic AI framework for industrial use.',
      growth_lever: 'Efficiency',
      applies_to: ['R&D'],
      action: 'Monitor',
      manufacturing_relevance: undefined,
      source_summary: '这条该来源的AI 主题更新主要讨论「Major AI Breakthrough Released」；当前先保留来源关键信息，建议点击查看完整细节。',
      business_domains: undefined,
    });
  });
});
