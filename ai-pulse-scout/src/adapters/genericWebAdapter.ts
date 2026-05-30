import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { buildStableIdentity } from '../ingest/identity.js';
import { normalizePublishedAt } from '../ingest/timestamps.js';
import type { IngestedItem, SourceIngestionResult } from '../ingest/types.js';
import type { SourceConfig } from '../types/config.js';
import type { ProductionSourceAdapter } from './types.js';
import { fetchText } from './shared/http.js';
import { extractCanonicalUrl, resolveUrl } from './shared/html.js';
import { inferPrimaryTopic } from '../topics/inferPrimaryTopic.js';
import { classifyEntryPage } from './webpage/classifyEntryPage.js';
import { extractCandidates } from './webpage/extractCandidates.js';
import { extractDetail } from './webpage/extractDetail.js';
import { normalizeWebpageItem } from './webpage/normalizeWebpageItem.js';

export function extractFeedUrlFromHtml(baseUrl: string, html: string): string | null {
  const match = html.match(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'][^"']*(rss|atom)\+xml[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["'][^"']*(rss|atom)\+xml[^"']*["'][^>]*>/i);

  if (!match) return null;
  const href = match[2] ?? match[1];
  return resolveUrl(baseUrl, href);
}

export function extractRecentArticleLinksFromHtml(baseUrl: string, html: string): string[] {
  return extractCandidates(baseUrl, html, { maxCandidates: 10 });
}

interface GenericWebAdapterDeps {
  fetchHtml?: (url: string) => Promise<string>;
}

function mapFeedItem(source: SourceConfig, item: Awaited<ReturnType<typeof fetchRssSource>>['items'][number]): IngestedItem {
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
    rawMetadata: {
      adapterType: 'webpage',
      extractionLevel: 'article_full',
      candidateOrigin: 'feed_auto_discovery',
      degradeReason: null,
      publishedAtConfidence: published.publishedAtConfidence,
    },
    id: item.id,
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
}

export class GenericWebAdapter implements ProductionSourceAdapter {
  constructor(private readonly deps: GenericWebAdapterDeps = {}) {}

  private async getHtml(url: string): Promise<string> {
    return this.deps.fetchHtml ? this.deps.fetchHtml(url) : fetchText(url);
  }

  canHandle(source: SourceConfig): boolean {
    return source.type === 'webpage';
  }

  async ingest({ source, windowStart, windowEnd }: { source: SourceConfig; windowStart: Date; windowEnd: Date; }): Promise<SourceIngestionResult> {
    try {
      const entryHtml = await this.getHtml(source.url);
      const feedUrl = extractFeedUrlFromHtml(source.url, entryHtml);

      if (feedUrl) {
        const result = await fetchRssSource({ ...source, url: feedUrl, type: 'rss' }, windowStart, windowEnd);
        const items = result.items.map((item) => mapFeedItem(source, item));

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

      const entryKind = classifyEntryPage(source.url, entryHtml);
      const items: IngestedItem[] = [];
      let degradedCount = 0;

      if (entryKind === 'article_page') {
        const detail = extractDetail(source.url, entryHtml);
        const extractionLevel = detail.content ? 'article_full' : 'article_partial';
        if (detail.content || detail.title !== '(untitled)') {
          items.push(normalizeWebpageItem({
            source,
            itemUrl: source.url,
            canonicalUrl: detail.canonicalUrl,
            title: detail.title,
            publishedAt: detail.publishedAt,
            publishedAtConfidence: detail.publishedAtConfidence,
            content: detail.content,
            summaryMaterial: detail.summaryMaterial,
            extractionLevel,
            candidateOrigin: 'entry_page_direct_article',
            degradeReason: extractionLevel === 'article_partial' ? 'missing_published_at' : null,
          }));
          if (extractionLevel !== 'article_full') degradedCount += 1;
        }
      } else {
        const candidates = extractCandidates(source.url, entryHtml, { maxCandidates: 5 });

        for (const candidateUrl of candidates) {
          try {
            const detailHtml = await this.getHtml(candidateUrl);
            const detail = extractDetail(candidateUrl, detailHtml);
            const hasArticleGradeContent = Boolean(detail.content);

            if (hasArticleGradeContent) {
              items.push(normalizeWebpageItem({
                source,
                itemUrl: candidateUrl,
                canonicalUrl: detail.canonicalUrl,
                title: detail.title,
                publishedAt: detail.publishedAt,
                publishedAtConfidence: detail.publishedAtConfidence,
                content: detail.content,
                summaryMaterial: detail.summaryMaterial,
                extractionLevel: 'article_full',
                candidateOrigin: 'listing_page_upgraded_detail',
                degradeReason: null,
              }));
            } else {
              items.push(normalizeWebpageItem({
                source,
                itemUrl: candidateUrl,
                canonicalUrl: detail.canonicalUrl,
                title: detail.title,
                publishedAt: null,
                publishedAtConfidence: 'fallback_discovered_at',
                content: '',
                summaryMaterial: '',
                extractionLevel: 'link_only',
                candidateOrigin: entryKind === 'listing_page' ? 'listing_page_candidate' : 'listing_page_candidate',
                degradeReason: 'content_extraction_failed',
              }));
              degradedCount += 1;
            }
          } catch {
            items.push(normalizeWebpageItem({
              source,
              itemUrl: candidateUrl,
              canonicalUrl: candidateUrl,
              title: 'Discovered article',
              publishedAt: null,
              publishedAtConfidence: 'fallback_discovered_at',
              content: '',
              summaryMaterial: '',
              extractionLevel: 'link_only',
              candidateOrigin: 'listing_page_candidate',
              degradeReason: 'detail_fetch_failed',
            }));
            degradedCount += 1;
          }
        }
      }

      if (items.length === 0) {
        return {
          source,
          status: 'broken',
          items: [],
          diagnostics: {
            attempted: 0,
            normalized: 0,
            dropped: 0,
            adapterType: 'webpage',
            reason: `No meaningful webpage items extracted from ${entryKind}`,
          },
        };
      }

      return {
        source,
        status: degradedCount > 0 ? 'partial_supported' : 'production_supported',
        items,
        diagnostics: {
          attempted: items.length,
          normalized: items.length,
          dropped: 0,
          adapterType: 'webpage',
          reason: degradedCount > 0 ? 'Layered webpage extraction produced degraded fallback items.' : undefined,
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
