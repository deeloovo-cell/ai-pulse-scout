import type { SourceAdapter } from './types.js';
import type { SourceUniverseRecord } from '../inbox/types.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import type { SourceConfig } from '../types/config.js';

function resolveUrl(baseUrl: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

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

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AI-Pulse-Scout/0.1; +https://github.com/deeloovo-cell/ai-pulse-scout)'
      }
    });
    if (!response.ok) throw new Error(`Status code ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function toSourceConfig(source: SourceUniverseRecord, url: string): SourceConfig {
  return {
    name: source.label ?? source.url,
    category: source.section,
    url,
    type: 'rss',
    enabled: true,
  } as SourceConfig;
}

export class GenericWebAdapter implements SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean {
    return source.classification.strategy === 'generic_web_discovery' || source.classification.strategy === 'research_listing_discovery';
  }

  async run(source: SourceUniverseRecord) {
    try {
      const html = await fetchHtml(source.url);
      const feedUrl = extractFeedUrlFromHtml(source.url, html);

      if (feedUrl) {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const result = await fetchRssSource(toSourceConfig(source, feedUrl), windowStart, now);

        if (result.error) {
          return {
            source,
            status: 'failed',
            discoveredCount: 0,
            error: result.error,
          } as const;
        }

        return {
          source,
          status: result.items.length > 0 ? 'success' : 'empty',
          discoveredCount: result.items.length,
        } as const;
      }

      const links = extractRecentArticleLinksFromHtml(source.url, html);
      return {
        source,
        status: links.length > 0 ? 'success' : 'empty',
        discoveredCount: links.length,
      } as const;
    } catch (error) {
      return {
        source,
        status: 'failed',
        discoveredCount: 0,
        error: error instanceof Error ? error.message : String(error),
      } as const;
    }
  }
}
