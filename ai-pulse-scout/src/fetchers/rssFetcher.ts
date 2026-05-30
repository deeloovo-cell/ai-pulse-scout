import Parser from 'rss-parser';
import type { SourceConfig } from '../types/config.js';
import type { NormalizedItem } from '../types/item.js';
import { normalizeRssItem } from '../normalize/normalizeItem.js';
import { isWithinWindow } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const parser = new Parser({ timeout: 15000 });

export interface FetchResult {
  source: SourceConfig;
  items: NormalizedItem[];
  error?: string;
}

export async function fetchRssSource(
  source: SourceConfig,
  windowStart: Date,
  now: Date,
): Promise<FetchResult> {
  try {
    logger.info(`Fetching ${source.name} (${source.url})`);
    const feed = await parser.parseURL(source.url);
    const items: NormalizedItem[] = [];

    for (const rawItem of feed.items ?? []) {
      const normalized = normalizeRssItem(rawItem, source);
      if (isWithinWindow(normalized.published_at, windowStart, now)) {
        items.push(normalized);
      }
    }

    logger.info(`  → ${items.length} items in window from ${source.name}`);
    return { source, items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to fetch ${source.name}: ${msg}`);
    return { source, items: [], error: msg };
  }
}

export async function fetchAllSources(
  sources: SourceConfig[],
  windowStart: Date,
  now: Date,
): Promise<FetchResult[]> {
  const rssSources = sources.filter((s) => s.type === 'rss' || s.type === 'atom' || s.type === 'podcast');
  const results = await Promise.allSettled(
    rssSources.map((s) => fetchRssSource(s, windowStart, now)),
  );
  return results.map((r) => (r.status === 'fulfilled' ? r.value : { source: rssSources[0], items: [], error: 'Promise rejected' }));
}
