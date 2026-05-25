import type { NormalizedItem } from '../types/item.js';
import { logger } from '../utils/logger.js';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';
const DEFAULT_MODEL = 'deepseek-v3.2';
const MAX_ARTICLE_CHARS = 12000;
const MAX_CONTEXT_CHARS = 14000;
const MAX_INSIGHT_WORDS = 100;

interface ChatCompletionsResult {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface KeyInsightOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  endpoint?: string;
  fetchFullPosts?: boolean;
}

export async function enrichKeyInsights(
  items: NormalizedItem[],
  options: KeyInsightOptions = {},
): Promise<NormalizedItem[]> {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? process.env.GLM_API_KEY;
  if (!apiKey) {
    logger.info('DEEPSEEK_API_KEY not set (and GLM_API_KEY fallback missing) -- using feed excerpts as key insights.');
    return items;
  }

  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? process.env.GLM_MODEL ?? DEFAULT_MODEL;
  const baseUrl =
    options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? process.env.GLM_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL;
  const endpoint = options.endpoint ?? buildChatCompletionsEndpoint(baseUrl);
  const fetchFullPosts =
    options.fetchFullPosts ??
    (process.env.DEEPSEEK_FETCH_FULL_POSTS ?? process.env.GLM_FETCH_FULL_POSTS) !== 'false';

  const enriched: NormalizedItem[] = [];
  for (const item of items) {
    try {
      const articleText = fetchFullPosts ? await fetchArticleText(item.item_url) : null;
      const keyInsight = await generateKeyInsight({
        item,
        articleText,
        apiKey,
        model,
        endpoint,
      });
      enriched.push(keyInsight ? { ...item, key_insight: keyInsight } : item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`DeepSeek key insight analysis failed for "${item.title}": ${message}`);
      enriched.push(item);
    }
  }

  return enriched;
}

async function generateKeyInsight(options: {
  item: NormalizedItem;
  articleText: string | null;
  apiKey: string;
  model: string;
  endpoint: string;
}): Promise<string | null> {
  const { item, articleText, apiKey, model, endpoint } = options;
  const context = buildArticleContext(item, articleText);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You analyze AI and engineering posts for a CIO. Return one concrete key insight in English. Focus on what actually changed, why it matters, and avoid generic filler.',
        },
        {
          role: 'user',
          content: `Analyze this post and write one executive-ready key insight for a daily digest. Keep it focused, concrete, and ${MAX_INSIGHT_WORDS} words or fewer.\n\n${context}`,
        },
      ],
      thinking: {
        type: 'disabled',
      },
      max_tokens: 800,
      temperature: 0.2,
    }),
  });

  const payload = (await response.json()) as ChatCompletionsResult;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `DeepSeek request failed with HTTP ${response.status}`);
  }

  return cleanInsight(extractOutputText(payload));
}

function buildArticleContext(item: NormalizedItem, articleText: string | null): string {
  const text = articleText || item.content_text || item.summary;
  return [
    `Title: ${item.title}`,
    `Source: ${item.source_name}`,
    `Category: ${item.source_category}`,
    `URL: ${item.item_url}`,
    `Existing feed summary: ${item.summary}`,
    `Post text:\n${text.slice(0, MAX_CONTEXT_CHARS)}`,
  ].join('\n\n');
}

function extractOutputText(payload: ChatCompletionsResult): string {
  return payload.choices?.[0]?.message?.content ?? '';
}

function buildChatCompletionsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function cleanInsight(raw: string): string | null {
  const cleaned = raw
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

async function fetchArticleText(url: string): Promise<string | null> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AI Pulse Scout/0.1 (+https://deanlu.ai)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;

    const body = await response.text();
    return stripHtml(body).slice(0, MAX_ARTICLE_CHARS);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
