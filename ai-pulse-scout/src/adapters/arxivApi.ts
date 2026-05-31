import { randomUUID } from 'node:crypto';
import type { IngestedItem } from '../ingest/types.js';
import { buildStableIdentity } from '../ingest/identity.js';
import { inferPrimaryTopic } from '../topics/inferPrimaryTopic.js';
import type { SourceConfig } from '../types/config.js';

export interface ArxivApiEntry {
  id: string;
  title: string;
  summary: string;
  publishedAt: Date;
  updatedAt: Date;
  primaryCategory: string;
  canonicalUrl: string;
  authors: string[];
}

export function isArxivRssSourceUrl(url: string): boolean {
  return /^https:\/\/arxiv\.org\/rss\//.test(url);
}

export function extractArxivCategoryFromSourceUrl(url: string): string | null {
  const match = url.match(/\/rss\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseArxivApiResponse(xml: string): ArxivApiEntry[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);

  return entries.map((entryXml) => {
    const readTag = (tag: string) => {
      const match = entryXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? decodeXml(match[1]) : '';
    };

    const idUrl = readTag('id');
    const id = idUrl.split('/').pop() ?? idUrl;
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]+)"/);
    const authorMatches = [...entryXml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)];

    return {
      id,
      title: readTag('title'),
      summary: readTag('summary'),
      publishedAt: new Date(readTag('published')),
      updatedAt: new Date(readTag('updated')),
      primaryCategory: categoryMatch?.[1] ?? '',
      canonicalUrl: `https://arxiv.org/abs/${id}`,
      authors: authorMatches.map((match) => decodeXml(match[1])),
    };
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArxivApiResponse(category: string): Promise<ArxivApiEntry[]> {
  const query = new URL('https://arxiv.org/api/query');
  query.searchParams.set('search_query', `cat:${category}`);
  query.searchParams.set('sortBy', 'submittedDate');
  query.searchParams.set('sortOrder', 'descending');
  query.searchParams.set('start', '0');
  query.searchParams.set('max_results', '20');

  const retryStatuses = new Set([429, 503]);
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(query);
    if (response.ok) {
      const xml = await response.text();
      return parseArxivApiResponse(xml);
    }

    lastStatus = response.status;
    if (!retryStatuses.has(response.status) || attempt === 2) {
      throw new Error(`arXiv API request failed for ${category}: ${response.status}`);
    }

    await sleep(500 * (attempt + 1));
  }

  throw new Error(`arXiv API request failed for ${category}: ${lastStatus ?? 'unknown'}`);
}

export async function fetchArxivApiEntries(category: string, windowStart: Date, windowEnd: Date): Promise<ArxivApiEntry[]> {
  const entries = await fetchArxivApiResponse(category);
  return entries.filter((entry) => entry.publishedAt >= windowStart && entry.publishedAt < windowEnd);
}

export async function fetchLatestArxivApiEntries(category: string): Promise<ArxivApiEntry[]> {
  return fetchArxivApiResponse(category);
}

function mapArxivEntriesToIngestedItems(source: SourceConfig, entries: ArxivApiEntry[]): IngestedItem[] {
  return entries.map((entry) => {
    const stableIdentity = buildStableIdentity({
      canonicalUrl: entry.canonicalUrl,
      itemUrl: entry.canonicalUrl,
      sourceUrl: source.url,
      title: entry.title,
      publishedAt: entry.publishedAt.toISOString(),
    });
    const topic = inferPrimaryTopic({
      sourceUrl: source.url,
      title: entry.title,
      content: entry.summary,
    });

    return {
      sourceType: source.type,
      sourceUrl: source.url,
      sourceName: source.name,
      itemUrl: entry.canonicalUrl,
      canonicalUrl: entry.canonicalUrl,
      title: entry.title,
      publishedAt: entry.publishedAt.toISOString(),
      publishedAtConfidence: 'exact',
      discoveredAt: new Date().toISOString(),
      content: entry.summary,
      summaryMaterial: entry.summary,
      stableIdentity,
      topicHints: [entry.primaryCategory || topic],
      rawMetadata: {
        sourceCategory: source.category,
        adapterType: 'arxiv-api',
        arxivCategory: entry.primaryCategory,
        authors: entry.authors,
      },
      id: randomUUID(),
      source_name: source.name,
      source_category: source.category,
      source_url: source.url,
      item_url: entry.canonicalUrl,
      published_at: entry.publishedAt,
      fetched_at: new Date(),
      author: entry.authors.join(', '),
      content_text: entry.summary,
      summary: entry.summary.slice(0, 300),
      tags: entry.primaryCategory ? [entry.primaryCategory] : [],
      content_type: 'article',
      fingerprint: stableIdentity,
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
      primary_topic: topic,
    } satisfies IngestedItem;
  });
}

export async function fetchArxivApiEntriesForSource(
  source: SourceConfig,
  windowStart: Date,
  windowEnd: Date,
): Promise<IngestedItem[]> {
  const category = extractArxivCategoryFromSourceUrl(source.url);
  if (!category) {
    return [];
  }

  const entries = await fetchArxivApiEntries(category, windowStart, windowEnd);
  return mapArxivEntriesToIngestedItems(source, entries);
}

export async function fetchLatestArxivEntriesForSource(source: SourceConfig): Promise<IngestedItem[]> {
  const category = extractArxivCategoryFromSourceUrl(source.url);
  if (!category) {
    return [];
  }

  const entries = await fetchLatestArxivApiEntries(category);
  return mapArxivEntriesToIngestedItems(source, entries);
}
