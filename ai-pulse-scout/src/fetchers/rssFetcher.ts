import Parser from 'rss-parser';
import type { SourceConfig } from '../types/config.js';
import type { NormalizedItem } from '../types/item.js';
import { normalizeRssItem } from '../normalize/normalizeItem.js';
import { isWithinWindow } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { sanitizeRssXml } from './rssSanitize.js';

const parser = new Parser({ timeout: 15000 });
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; AI-Pulse-Scout/0.1; +https://github.com/deeloovo-cell/ai-pulse-scout)',
  accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

export interface FetchResult {
  source: SourceConfig;
  items: NormalizedItem[];
  error?: string;
}

interface FetchRssSourceOptions {
  fetchImpl?: typeof fetch;
  parser?: Pick<Parser, 'parseString'>;
  sleep?: (ms: number) => Promise<void>;
}

export async function fetchRssSource(
  source: SourceConfig,
  windowStart: Date,
  now: Date,
  options: FetchRssSourceOptions = {},
): Promise<FetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const parserImpl = options.parser ?? parser;
  const sleep = options.sleep ?? defaultSleep;

  try {
    logger.info(`Fetching ${source.name} (${source.url})`);
    const xml = await fetchRssXml(source.url, fetchImpl, sleep);
    const sanitizedXml = sanitizeRssXml(xml);
    const feed = await parserImpl.parseString(sanitizedXml);
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

async function fetchRssXml(
  url: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  const first = await fetchOnce(url, fetchImpl);
  if (first.status === 429) {
    await sleep(retryDelayMs(first.response));
    const second = await fetchOnce(url, fetchImpl);
    if (!second.response.ok) throw new Error(`Status code ${second.status}`);
    return await second.response.text();
  }

  if (!first.response.ok) throw new Error(`Status code ${first.status}`);
  return await first.response.text();
}

async function fetchOnce(url: string, fetchImpl: typeof fetch): Promise<{ response: Response; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: DEFAULT_HEADERS,
    });
    return { response, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelayMs(response: Response): number {
  const retryAfter = response.headers.get('Retry-After');
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return 1500;
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
