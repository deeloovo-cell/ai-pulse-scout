import { randomUUID } from 'node:crypto';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { buildStableIdentity } from '../ingest/identity.js';
import { normalizePublishedAt } from '../ingest/timestamps.js';
import type { IngestedItem, SourceIngestionResult } from '../ingest/types.js';
import type { SourceConfig } from '../types/config.js';
import type { ProductionSourceAdapter } from './types.js';
import { fetchText } from './shared/http.js';
import { extractCanonicalUrl, resolveUrl } from './shared/html.js';
import { inferPrimaryTopic } from '../topics/inferPrimaryTopic.js';

export function extractFeedUrlFromHtml(baseUrl: string, html: string): string | null {
  const match = html.match(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'][^"']*(rss|atom)\+xml[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["'][^"']*(rss|atom)\+xml[^"']*["'][^>]*>/i);

  if (!match) return null;
  const href = match[2] ?? match[1];
  return resolveUrl(baseUrl, href);
}

export function extractRecentArticleLinksFromHtml(baseUrl: string, html: string): string[] {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)];
  const urls = matches
    .map((m) => resolveUrl(baseUrl, m[1]))
    .filter((u) => /^https?:\/\//.test(u))
    .filter((u) => !/\/about\/?$|\/contact\/?$|\/privacy\/?$|\/terms\/?$/i.test(u))
    .filter((u) => /\/blog\/|\/post|\/posts\/|\/article|\/articles\/|\/news\/|\/research\/|\/podcast/i.test(u));

  return [...new Set(urls)].slice(0, 10);
}

function toPartialItem(source: SourceConfig, itemUrl: string, title: string): IngestedItem {
  const stableIdentity = buildStableIdentity({
    canonicalUrl: itemUrl,
    itemUrl,
    sourceUrl: source.url,
    title,
    publishedAt: null,
  });
  const topic = inferPrimaryTopic({ sourceUrl: source.url, title, content: '' });
  const published = normalizePublishedAt(null);

  return {
    sourceType: source.type,
    sourceUrl: source.url,
    sourceName: source.name,
    itemUrl,
    canonicalUrl: itemUrl,
    title,
    publishedAt: published.publishedAt,
    publishedAtConfidence: published.publishedAtConfidence,
    discoveredAt: new Date().toISOString(),
    content: '',
    summaryMaterial: '',
    stableIdentity,
    topicHints: [topic],
    rawMetadata: { adapterType: 'webpage', extractionMethod: 'article_link_discovery' },
    id: randomUUID(),
    source_name: source.name,
    source_category: source.category,
    source_url: source.url,
    item_url: itemUrl,
    published_at: null,
    fetched_at: new Date(),
    author: '',
    content_text: '',
    summary: '',
    tags: [],
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
  };
}

export class GenericWebAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'webpage';
  }

  async ingest({ source, windowStart, windowEnd }: { source: SourceConfig; windowStart: Date; windowEnd: Date; }): Promise<SourceIngestionResult> {
    try {
      const html = await fetchText(source.url);
      const feedUrl = extractFeedUrlFromHtml(source.url, html);

      if (feedUrl) {
        const result = await fetchRssSource({ ...source, url: feedUrl, type: 'rss' }, windowStart, windowEnd);
        const items = result.items.map((item) => {
          const canonicalUrl = extractCanonicalUrl(item.content_html ?? '') ?? item.item_url;
          const published = normalizePublishedAt(item.published_at?.toISOString() ?? null);
          const stableIdentity = buildStableIdentity({
            canonicalUrl,
            itemUrl: item.item_url,
            sourceUrl: source.url,
            title: item.title,
            publishedAt: published.publishedAt,
          });
          const topic = inferPrimaryTopic({ sourceUrl: source.url, title: item.title, content: item.content_text });
          return {
            sourceType: 'webpage',
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: item.item_url,
            canonicalUrl,
            title: item.title,
            publishedAt: published.publishedAt,
            publishedAtConfidence: published.publishedAtConfidence,
            discoveredAt: new Date().toISOString(),
            content: item.content_text,
            summaryMaterial: item.content_text,
            stableIdentity,
            topicHints: [topic],
            rawMetadata: { adapterType: 'webpage', extractionMethod: 'feed_auto_discovery' },
            id: randomUUID(),
            source_name: source.name,
            source_category: source.category,
            source_url: source.url,
            item_url: item.item_url,
            published_at: item.published_at,
            fetched_at: new Date(),
            author: item.author,
            content_text: item.content_text,
            content_html: item.content_html,
            summary: item.summary,
            tags: item.tags,
            content_type: item.content_type,
            fingerprint: stableIdentity,
            relevance_scores: item.relevance_scores,
            decision: item.decision,
            decision_reason: item.decision_reason,
            primary_topic: topic,
          } satisfies IngestedItem;
        });

        return {
          source,
          status: 'production_supported',
          items,
          diagnostics: {
            attempted: items.length,
            normalized: items.length,
            dropped: 0,
            adapterType: 'webpage',
          },
        };
      }

      const links = extractRecentArticleLinksFromHtml(source.url, html);
      const items = links.map((link, index) => toPartialItem(source, link, `Discovered article ${index + 1}`));
      return {
        source,
        status: items.length > 0 ? 'partial_supported' : 'partial_supported',
        items,
        diagnostics: {
          attempted: links.length,
          normalized: items.length,
          dropped: 0,
          adapterType: 'webpage',
          reason: 'Article-link discovery available, but full article extraction remains heuristic.',
        },
      };
    } catch (error) {
      return {
        source,
        status: 'broken',
        items: [],
        diagnostics: {
          attempted: 0,
          normalized: 0,
          dropped: 0,
          adapterType: 'webpage',
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
