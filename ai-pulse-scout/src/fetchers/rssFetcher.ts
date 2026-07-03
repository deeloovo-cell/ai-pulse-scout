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

// How many times to retry after a 429 before giving up on a source.
const MAX_RETRY_ATTEMPTS = 2;

// Base delay (ms) when the server sends no Retry-After header.
// Grows exponentially: 5 s → 10 s on the second retry.
const FALLBACK_RETRY_DELAY_MS = 5_000;

// Pause inserted between consecutive serial Reddit / HN fetches so we don't
// immediately 429 the next subreddit right after finishing the previous one.
const HIGH_RISK_INTER_SOURCE_DELAY_MS = 2_000;

export interface FetchResult {
  source: SourceConfig;
  items: NormalizedItem[];
  error?: string;
}

export interface FetchRssSourceOptions {
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
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const result = await fetchOnce(url, fetchImpl);
    if (result.response.ok) return await result.response.text();

    if (result.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
      const delay = retryDelayMs(result.response, attempt);
      logger.warn(`  → 429 rate-limited (${url}); retry ${attempt + 1}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
      await sleep(delay);
      continue;
    }

    throw new Error(`Status code ${result.status}`);
  }

  // Unreachable — the loop always either returns or throws — but satisfies TS.
  throw new Error('fetchRssXml: max retries exceeded');
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

function retryDelayMs(response: Response, attempt = 0): number {
  const retryAfter = response.headers.get('Retry-After');
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  // Exponential back-off: 5 s on the first retry, 10 s on the second.
  return FALLBACK_RETRY_DELAY_MS * Math.pow(2, attempt);
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllSources(
  sources: SourceConfig[],
  windowStart: Date,
  now: Date,
  options: FetchRssSourceOptions = {},
): Promise<FetchResult[]> {
  const rssSources = sources.filter((s) => s.type === 'rss' || s.type === 'atom' || s.type === 'podcast');
  const serialSources = rssSources.filter(isHighRiskThrottledSource);
  const parallelSources = rssSources.filter((source) => !isHighRiskThrottledSource(source));

  const sleep = options.sleep ?? defaultSleep;
  const serialResults: FetchResult[] = [];
  for (let i = 0; i < serialSources.length; i++) {
    // Pause between consecutive high-risk sources (Reddit, HN) so we don't
    // immediately trigger a 429 on the next domain right after the last.
    if (i > 0) await sleep(HIGH_RISK_INTER_SOURCE_DELAY_MS);
    serialResults.push(await fetchRssSource(serialSources[i]!, windowStart, now, options));
  }

  const parallelSettled = await Promise.allSettled(
    parallelSources.map((source) => fetchRssSource(source, windowStart, now, options)),
  );
  const parallelResults = parallelSettled.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : { source: parallelSources[index]!, items: [], error: 'Promise rejected' },
  );

  const resultByUrl = new Map<string, FetchResult>();
  for (const result of [...serialResults, ...parallelResults]) {
    resultByUrl.set(result.source.url, result);
  }

  return rssSources.map((source) => resultByUrl.get(source.url) ?? { source, items: [], error: 'Promise rejected' });
}

function isHighRiskThrottledSource(source: SourceConfig): boolean {
  return /reddit\.com|hnrss\.org/i.test(source.url);
}
