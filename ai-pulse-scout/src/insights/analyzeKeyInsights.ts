import type { NormalizedItem } from '../types/item.js';
import { logger } from '../utils/logger.js';
import { requestChatCompletion, resolveLlmClient } from './chatCompletions.js';
import {
  defaultExecutiveInsight,
  parseExecutiveInsightResponse,
} from './parseExecutiveInsight.js';

const MAX_ARTICLE_CHARS = 12000;
const MAX_CONTEXT_CHARS = 14000;

const ITEM_SYSTEM_PROMPT = `You analyze AI and engineering signals for a CIO and Chief AI Officer at a high-tech manufacturing company.
Return ONLY valid JSON:
{
  "why_it_matters": "80-120 words, concrete, no hype — what changed and why it matters for manufacturing growth",
  "growth_lever": "Efficiency|Quality|Revenue|Speed|Risk",
  "applies_to": ["Design|Process|Shop floor|Supply chain|R&D"],
  "action": "Monitor|Evaluate pilot|Engage partner",
  "manufacturing_relevance": "High|Medium|Low"
}
Include manufacturing_relevance for research papers; omit for product/news posts.
Focus on robotics, physical AI, CAD/CAM, sim-to-real, enterprise AI, and manufacturing AI when relevant.`;

export interface KeyInsightOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFullPosts?: boolean;
}

export async function enrichKeyInsights(
  items: NormalizedItem[],
  options: KeyInsightOptions = {},
): Promise<NormalizedItem[]> {
  const client = resolveLlmClient(options);
  if (!client) {
    logger.info('DEEPSEEK_API_KEY not set (and GLM_API_KEY fallback missing) -- using feed excerpts as key insights.');
    return items.map((item) => attachFallbackInsight(item));
  }

  const fetchFullPosts =
    options.fetchFullPosts ??
    (process.env.DEEPSEEK_FETCH_FULL_POSTS ?? process.env.GLM_FETCH_FULL_POSTS) !== 'false';

  const enriched: NormalizedItem[] = [];
  for (const item of items) {
    try {
      const articleText = fetchFullPosts ? await fetchArticleText(item.item_url) : null;
      const raw = await requestChatCompletion(
        client,
        [
          { role: 'system', content: ITEM_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this item for the daily manufacturing AI digest.\n\n${buildArticleContext(item, articleText)}`,
          },
        ],
        900,
      );
      enriched.push(applyInsightResponse(item, raw));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Executive insight analysis failed for "${item.title}": ${message}`);
      enriched.push(attachFallbackInsight(item));
    }
  }

  return enriched;
}

function applyInsightResponse(item: NormalizedItem, raw: string): NormalizedItem {
  const parsed = parseExecutiveInsightResponse(raw);
  if (parsed) {
    return {
      ...item,
      executive_insight: parsed,
      key_insight: parsed.why_it_matters,
    };
  }

  const plain = cleanPlainInsight(raw);
  if (plain) {
    const fallback = defaultExecutiveInsight(plain, isPaperItem(item));
    return { ...item, executive_insight: fallback, key_insight: plain };
  }

  return attachFallbackInsight(item);
}

function attachFallbackInsight(item: NormalizedItem): NormalizedItem {
  const text =
    item.summary ||
    item.content_text.slice(0, 250) ||
    (item.rawMetadata?.extractionLevel === 'link_only'
      ? 'Source link retained for manual review; automated extraction was incomplete.'
      : 'Open the source for full details.');

  const insight = defaultExecutiveInsight(text, isPaperItem(item));
  return {
    ...item,
    executive_insight: insight,
    key_insight: insight.why_it_matters,
  };
}

function isPaperItem(item: NormalizedItem): boolean {
  return (
    item.content_type === 'research' ||
    /arxiv\.org/i.test(item.item_url) ||
    /arxiv\.org/i.test(item.source_url)
  );
}

function buildArticleContext(item: NormalizedItem, articleText: string | null): string {
  const text = articleText || item.content_text || item.summary;
  return [
    `Title: ${item.title}`,
    `Source: ${item.source_name}`,
    `Category: ${item.source_category}`,
    `Primary topic: ${item.primary_topic}`,
    `URL: ${item.item_url}`,
    `Existing feed summary: ${item.summary}`,
    `Post text:\n${text.slice(0, MAX_CONTEXT_CHARS)}`,
  ].join('\n\n');
}

function cleanPlainInsight(raw: string): string | null {
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
