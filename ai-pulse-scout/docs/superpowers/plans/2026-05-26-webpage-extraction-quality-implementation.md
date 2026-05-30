# Webpage Extraction Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade webpage ingestion from heuristic link discovery into a layered production path that classifies entry pages, upgrades listing candidates into article-grade items when possible, and preserves degraded link-grade items when full extraction fails.

**Architecture:** Keep `src/adapters/genericWebAdapter.ts` as the orchestration boundary, but move page classification, candidate extraction, detail extraction, and webpage-item normalization into focused helper modules. Preserve the compatibility-first bridge by mapping both article-grade and degraded-link-grade webpage results into the shared `IngestedItem` shape so existing digest code continues to run while selection and rendering become quality-aware.

**Tech Stack:** TypeScript, Vitest, existing unified ingestion/adapters layer, HTML regex/string parsing helpers, existing digest selection/rendering pipeline.

---

## File Map

### Create
- `src/adapters/webpage/classifyEntryPage.ts` — classify entry HTML as `feed_page | article_page | listing_page | unknown_page`
- `src/adapters/webpage/extractCandidates.ts` — extract and rank article-like candidate URLs from listing pages
- `src/adapters/webpage/extractDetail.ts` — extract title, canonical URL, published time, content, and summary material from detail pages
- `src/adapters/webpage/normalizeWebpageItem.ts` — map article-grade and degraded-link-grade webpage results into `IngestedItem`
- `tests/adapters/webpage/classifyEntryPage.test.ts`
- `tests/adapters/webpage/extractCandidates.test.ts`
- `tests/adapters/webpage/extractDetail.test.ts`
- `tests/adapters/webpage/normalizeWebpageItem.test.ts`
- `tests/adapters/genericWebAdapter.integration.test.ts`
- `tests/filtering/selectItems.webpageQuality.test.ts`

### Modify
- `src/adapters/genericWebAdapter.ts` — replace monolithic heuristics with helper-driven orchestration and layered upgrade logic
- `src/filtering/selectItems.ts` — lower priority for degraded webpage items and fallback timestamps while keeping compatibility
- `src/normalize/normalizeItem.ts` — preserve webpage extraction metadata through normalization when needed by downstream logic
- `src/types/item.ts` — extend shared item shape with webpage extraction metadata needed by downstream consumers
- `src/ingest/types.ts` — ensure unified ingestion item type can carry webpage extraction-level metadata cleanly
- `src/render/renderHtmlEmail.ts` — make sure degraded webpage items render safely without exposing engineering-heavy metadata

### Verify only
- `src/state/ledger.ts` — confirm current stable identity behavior already covers webpage detail/link downgrade cases
- `src/insights/analyzeKeyInsights.ts` — confirm degraded items do not break insight enrichment flow

---

### Task 1: Add failing tests for entry-page classification

**Files:**
- Create: `tests/adapters/webpage/classifyEntryPage.test.ts`
- Create: `src/adapters/webpage/classifyEntryPage.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { classifyEntryPage } from '../../../src/adapters/webpage/classifyEntryPage';

describe('classifyEntryPage', () => {
  it('classifies feed-capable pages from alternate feed links', () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/rss.xml" />
      </head></html>
    `;

    expect(classifyEntryPage('https://example.com/blog', html)).toBe('feed_page');
  });

  it('classifies direct article pages from article metadata', () => {
    const html = `
      <html><head>
        <meta property="article:published_time" content="2026-05-26T00:00:00Z" />
      </head><body><article><h1>Title</h1><p>Body</p></article></body></html>
    `;

    expect(classifyEntryPage('https://example.com/post-1', html)).toBe('article_page');
  });

  it('classifies listing pages from repeated article-like links', () => {
    const html = `
      <html><body>
        <a href="/blog/post-1">Post 1</a>
        <a href="/blog/post-2">Post 2</a>
        <a href="/blog/post-3">Post 3</a>
      </body></html>
    `;

    expect(classifyEntryPage('https://example.com/blog', html)).toBe('listing_page');
  });

  it('classifies weak pages as unknown when no useful signals exist', () => {
    const html = `<html><body><a href="/about">About</a></body></html>`;
    expect(classifyEntryPage('https://example.com', html)).toBe('unknown_page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/webpage/classifyEntryPage.test.ts`
Expected: FAIL with module-not-found or missing export for `classifyEntryPage`

- [ ] **Step 3: Write minimal implementation**

```ts
export type EntryPageKind = 'feed_page' | 'article_page' | 'listing_page' | 'unknown_page';

export function classifyEntryPage(_url: string, html: string): EntryPageKind {
  if (/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["'][^"']*(rss|atom)\+xml/i.test(html)) {
    return 'feed_page';
  }

  if (/(article:published_time|application\/ld\+json|<article[\s>])/i.test(html)) {
    return 'article_page';
  }

  const articleLikeLinks = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((href) => /\/blog\/|\/post|\/posts\/|\/article|\/articles\/|\/news\/|\/research\//i.test(href));

  if (articleLikeLinks.length >= 2) {
    return 'listing_page';
  }

  return 'unknown_page';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/webpage/classifyEntryPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/webpage/classifyEntryPage.ts tests/adapters/webpage/classifyEntryPage.test.ts
git commit -m "test: add webpage entry classification coverage"
```

### Task 2: Add failing tests for candidate extraction and ranking

**Files:**
- Create: `tests/adapters/webpage/extractCandidates.test.ts`
- Create: `src/adapters/webpage/extractCandidates.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { extractCandidates } from '../../../src/adapters/webpage/extractCandidates';

describe('extractCandidates', () => {
  it('prefers article-like links and excludes utility pages', () => {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="/blog/post-1">Post 1</a>
        <a href="/news/post-2">Post 2</a>
        <a href="/privacy">Privacy</a>
      </body></html>
    `;

    expect(extractCandidates('https://example.com', html)).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/news/post-2',
    ]);
  });

  it('deduplicates and caps the candidate list', () => {
    const html = `
      <html><body>
        <a href="/blog/post-1">One</a>
        <a href="/blog/post-1">One again</a>
        <a href="/blog/post-2">Two</a>
        <a href="/blog/post-3">Three</a>
      </body></html>
    `;

    expect(extractCandidates('https://example.com', html, { maxCandidates: 2 })).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/blog/post-2',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/webpage/extractCandidates.test.ts`
Expected: FAIL with module-not-found or missing export for `extractCandidates`

- [ ] **Step 3: Write minimal implementation**

```ts
import { resolveUrl } from '../shared/html.js';

interface ExtractCandidateOptions {
  maxCandidates?: number;
}

export function extractCandidates(baseUrl: string, html: string, options: ExtractCandidateOptions = {}): string[] {
  const maxCandidates = options.maxCandidates ?? 10;
  const urls = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => resolveUrl(baseUrl, match[1]))
    .filter((url) => /^https?:\/\//.test(url))
    .filter((url) => !/\/about\/?$|\/contact\/?$|\/privacy\/?$|\/terms\/?$/i.test(url))
    .filter((url) => /\/blog\/|\/post|\/posts\/|\/article|\/articles\/|\/news\/|\/research\//i.test(url));

  return [...new Set(urls)].slice(0, maxCandidates);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/webpage/extractCandidates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/webpage/extractCandidates.ts tests/adapters/webpage/extractCandidates.test.ts
git commit -m "feat: add webpage candidate extraction"
```

### Task 3: Add failing tests for detail extraction

**Files:**
- Create: `tests/adapters/webpage/extractDetail.test.ts`
- Create: `src/adapters/webpage/extractDetail.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { extractDetail } from '../../../src/adapters/webpage/extractDetail';

describe('extractDetail', () => {
  it('extracts title, canonical, exact timestamp, and article text', () => {
    const html = `
      <html><head>
        <title>Test Article</title>
        <link rel="canonical" href="https://example.com/post-1" />
        <meta property="article:published_time" content="2026-05-26T00:00:00Z" />
      </head><body>
        <article><p>Paragraph one.</p><p>Paragraph two.</p></article>
      </body></html>
    `;

    expect(extractDetail('https://example.com/post-1', html)).toMatchObject({
      title: 'Test Article',
      canonicalUrl: 'https://example.com/post-1',
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
    });
  });

  it('falls back to derived or missing content states safely', () => {
    const html = `
      <html><head><title>Weak Article</title></head><body>
        <main><p>Short body.</p></main>
      </body></html>
    `;

    expect(extractDetail('https://example.com/post-2', html)).toMatchObject({
      title: 'Weak Article',
      canonicalUrl: 'https://example.com/post-2',
      publishedAt: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/webpage/extractDetail.test.ts`
Expected: FAIL with module-not-found or missing export for `extractDetail`

- [ ] **Step 3: Write minimal implementation**

```ts
import { extractCanonicalUrl } from '../shared/html.js';
import { normalizePublishedAt } from '../../ingest/timestamps.js';

export interface ExtractedDetail {
  title: string;
  canonicalUrl: string;
  publishedAt: string | null;
  publishedAtConfidence: 'exact' | 'derived' | 'fallback_discovered_at';
  content: string;
  summaryMaterial: string;
}

export function extractDetail(url: string, html: string): ExtractedDetail {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? '(untitled)';
  const canonicalUrl = extractCanonicalUrl(html) ?? url;
  const rawPublished = html.match(/article:published_time[^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
  const published = normalizePublishedAt(rawPublished);
  const content = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    title,
    canonicalUrl,
    publishedAt: published.publishedAt,
    publishedAtConfidence: published.publishedAtConfidence,
    content,
    summaryMaterial: content,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/webpage/extractDetail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/webpage/extractDetail.ts tests/adapters/webpage/extractDetail.test.ts
git commit -m "feat: add webpage detail extraction"
```

### Task 4: Add failing tests for webpage item normalization

**Files:**
- Create: `tests/adapters/webpage/normalizeWebpageItem.test.ts`
- Create: `src/adapters/webpage/normalizeWebpageItem.ts`
- Modify: `src/types/item.ts`
- Modify: `src/ingest/types.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeWebpageItem } from '../../../src/adapters/webpage/normalizeWebpageItem';
import type { SourceConfig } from '../../../src/types/config';

const source: SourceConfig = {
  name: 'Web Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/blog',
  type: 'webpage',
  enabled: true,
};

describe('normalizeWebpageItem', () => {
  it('creates article_full items with webpage extraction metadata', () => {
    const item = normalizeWebpageItem({
      source,
      itemUrl: 'https://example.com/post-1',
      canonicalUrl: 'https://example.com/post-1',
      title: 'Post 1',
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
      content: 'Body',
      summaryMaterial: 'Body',
      extractionLevel: 'article_full',
      candidateOrigin: 'entry_page_direct_article',
      degradeReason: null,
    });

    expect(item.rawMetadata).toMatchObject({
      adapterType: 'webpage',
      extractionLevel: 'article_full',
      candidateOrigin: 'entry_page_direct_article',
    });
  });

  it('creates link_only items with fallback timestamp and degrade reason', () => {
    const item = normalizeWebpageItem({
      source,
      itemUrl: 'https://example.com/post-2',
      canonicalUrl: 'https://example.com/post-2',
      title: 'Post 2',
      publishedAt: null,
      publishedAtConfidence: 'fallback_discovered_at',
      content: '',
      summaryMaterial: '',
      extractionLevel: 'link_only',
      candidateOrigin: 'listing_page_candidate',
      degradeReason: 'content_extraction_failed',
    });

    expect(item.rawMetadata).toMatchObject({
      extractionLevel: 'link_only',
      degradeReason: 'content_extraction_failed',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/webpage/normalizeWebpageItem.test.ts`
Expected: FAIL with module-not-found or missing export for `normalizeWebpageItem`

- [ ] **Step 3: Write minimal implementation**

```ts
import { randomUUID } from 'node:crypto';
import { buildStableIdentity } from '../../ingest/identity.js';
import type { IngestedItem, PublishedAtConfidence } from '../../ingest/types.js';
import type { SourceConfig } from '../../types/config.js';
import { inferPrimaryTopic } from '../../topics/inferPrimaryTopic.js';

export type WebpageExtractionLevel = 'article_full' | 'article_partial' | 'link_only';
export type WebpageCandidateOrigin =
  | 'feed_auto_discovery'
  | 'entry_page_direct_article'
  | 'listing_page_candidate'
  | 'listing_page_upgraded_detail';
export type WebpageDegradeReason =
  | 'detail_fetch_failed'
  | 'content_extraction_failed'
  | 'missing_published_at'
  | 'insufficient_article_signals'
  | 'listing_only_candidate';

interface NormalizeWebpageItemInput {
  source: SourceConfig;
  itemUrl: string;
  canonicalUrl: string;
  title: string;
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
  content: string;
  summaryMaterial: string;
  extractionLevel: WebpageExtractionLevel;
  candidateOrigin: WebpageCandidateOrigin;
  degradeReason: WebpageDegradeReason | null;
}

export function normalizeWebpageItem(input: NormalizeWebpageItemInput): IngestedItem {
  const stableIdentity = buildStableIdentity({
    canonicalUrl: input.canonicalUrl,
    itemUrl: input.itemUrl,
    sourceUrl: input.source.url,
    title: input.title,
    publishedAt: input.publishedAt,
  });
  const topic = inferPrimaryTopic({ sourceUrl: input.source.url, title: input.title, content: input.content });
  const fetchedAt = new Date();

  return {
    sourceType: 'webpage',
    sourceUrl: input.source.url,
    sourceName: input.source.name,
    itemUrl: input.itemUrl,
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    publishedAt: input.publishedAt,
    publishedAtConfidence: input.publishedAtConfidence,
    discoveredAt: fetchedAt.toISOString(),
    content: input.content,
    summaryMaterial: input.summaryMaterial,
    stableIdentity,
    topicHints: [topic],
    rawMetadata: {
      adapterType: 'webpage',
      extractionLevel: input.extractionLevel,
      candidateOrigin: input.candidateOrigin,
      degradeReason: input.degradeReason,
    },
    id: randomUUID(),
    source_name: input.source.name,
    source_category: input.source.category,
    source_url: input.source.url,
    item_url: input.itemUrl,
    published_at: input.publishedAt ? new Date(input.publishedAt) : null,
    fetched_at: fetchedAt,
    author: '',
    content_text: input.content,
    summary: input.summaryMaterial,
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
```

- [ ] **Step 4: Update shared types so the new metadata is legal**

```ts
export type PublishedAtConfidence = 'exact' | 'derived' | 'fallback_discovered_at';
```

```ts
export interface WebpageExtractionMetadata {
  extractionLevel?: 'article_full' | 'article_partial' | 'link_only';
  candidateOrigin?: 'feed_auto_discovery' | 'entry_page_direct_article' | 'listing_page_candidate' | 'listing_page_upgraded_detail';
  degradeReason?: 'detail_fetch_failed' | 'content_extraction_failed' | 'missing_published_at' | 'insufficient_article_signals' | 'listing_only_candidate' | null;
}
```

Add the metadata shape to the relevant shared item contracts in `src/ingest/types.ts` and `src/types/item.ts` so downstream code can read it safely.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/adapters/webpage/normalizeWebpageItem.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/adapters/webpage/normalizeWebpageItem.ts src/ingest/types.ts src/types/item.ts tests/adapters/webpage/normalizeWebpageItem.test.ts
git commit -m "feat: add webpage normalization metadata"
```

### Task 5: Rework GenericWebAdapter orchestration with layered upgrade flow

**Files:**
- Modify: `src/adapters/genericWebAdapter.ts`
- Test: `tests/adapters/genericWebAdapter.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { GenericWebAdapter } from '../../src/adapters/genericWebAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Web Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/blog',
  type: 'webpage',
  enabled: true,
};

describe('GenericWebAdapter integration', () => {
  it('upgrades listing candidates into article-grade items and keeps degraded fallbacks', async () => {
    const htmlByUrl = new Map([
      ['https://example.com/blog', '<a href="/blog/post-1">Post 1</a><a href="/blog/post-2">Post 2</a>'],
      ['https://example.com/blog/post-1', '<title>Post 1</title><article><p>Body 1</p></article><meta property="article:published_time" content="2026-05-26T00:00:00Z" />'],
      ['https://example.com/blog/post-2', '<title>Post 2</title>'],
    ]);

    const adapter = new GenericWebAdapter({
      fetchHtml: vi.fn(async (url: string) => {
        const html = htmlByUrl.get(url);
        if (!html) throw new Error(`missing fixture for ${url}`);
        return html;
      }),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].rawMetadata).toMatchObject({ extractionLevel: 'article_full' });
    expect(result.items[1].rawMetadata).toMatchObject({ extractionLevel: 'link_only' });
  });

  it('marks the source broken when the entry page fetch fails', async () => {
    const adapter = new GenericWebAdapter({
      fetchHtml: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('broken');
    expect(result.items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/genericWebAdapter.integration.test.ts`
Expected: FAIL because the adapter does not yet support helper-driven listing->detail upgrade behavior or dependency injection for `fetchHtml`

- [ ] **Step 3: Refactor the adapter to inject HTML fetches and call the new helpers**

Implement this shape in `src/adapters/genericWebAdapter.ts`:

```ts
interface GenericWebAdapterDeps {
  fetchHtml?: (url: string) => Promise<string>;
}

export class GenericWebAdapter implements ProductionSourceAdapter {
  constructor(private readonly deps: GenericWebAdapterDeps = {}) {}

  private async getHtml(url: string): Promise<string> {
    return this.deps.fetchHtml ? this.deps.fetchHtml(url) : fetchText(url);
  }
}
```

Use the helper modules to implement the orchestration:

```ts
const entryHtml = await this.getHtml(source.url);
const entryKind = classifyEntryPage(source.url, entryHtml);

if (feedUrl) {
  // preserve current feed auto-discovery path
}

if (entryKind === 'article_page') {
  // extractDetail(source.url, entryHtml)
  // normalizeWebpageItem(... extractionLevel: 'article_full' | 'article_partial')
}

if (entryKind === 'listing_page') {
  const candidates = extractCandidates(source.url, entryHtml, { maxCandidates: 5 });
  // for each candidate: try detail extraction
  // success => article-grade item
  // failure/weak detail => link_only degraded item
}

if (entryKind === 'unknown_page') {
  // attempt limited candidate extraction anyway
  // if none => broken or partial depending on what was discovered
}
```

When deciding result status:

- all article-grade items => `production_supported`
- any degraded items but meaningful output => `partial_supported`
- no meaningful output due to entry fetch/parse failure => `broken`

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `npx vitest run tests/adapters/genericWebAdapter.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/genericWebAdapter.ts tests/adapters/genericWebAdapter.integration.test.ts
git commit -m "feat: add layered webpage adapter orchestration"
```

### Task 6: Make selection quality-aware for degraded webpage items

**Files:**
- Modify: `src/filtering/selectItems.ts`
- Create: `tests/filtering/selectItems.webpageQuality.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { selectItems } from '../../src/filtering/selectItems';
import type { NormalizedItem } from '../../src/types/item';

function makeItem(overrides: Partial<NormalizedItem>): NormalizedItem {
  const now = new Date('2026-05-26T00:00:00.000Z');
  return {
    id: 'id',
    source_name: 'Web Source',
    source_category: 'frontier-model-labs',
    source_url: 'https://example.com/blog',
    item_url: 'https://example.com/post',
    title: 'Title',
    published_at: now,
    fetched_at: now,
    author: '',
    content_text: 'Body',
    summary: 'Body',
    tags: [],
    content_type: 'article',
    fingerprint: 'fp',
    relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

describe('selectItems webpage quality weighting', () => {
  it('prefers article_full over link_only when timestamps are otherwise similar', () => {
    const articleFull = makeItem({
      id: 'full',
      item_url: 'https://example.com/post-1',
      rawMetadata: { extractionLevel: 'article_full' },
    });
    const linkOnly = makeItem({
      id: 'link',
      item_url: 'https://example.com/post-2',
      rawMetadata: { extractionLevel: 'link_only' },
    });

    const selected = selectItems([linkOnly, articleFull], { max_items: 10, min_items: 1, collection_window_hours: 24, safety_buffer_hours: 0 });
    expect(selected[0].id).toBe('full');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/filtering/selectItems.webpageQuality.test.ts`
Expected: FAIL because `selectItems` currently sorts only by published/fetched time

- [ ] **Step 3: Add a small quality-aware sort weight**

Update `src/filtering/selectItems.ts` to compute a score that keeps time first but nudges full article extraction above degraded items:

```ts
function extractionWeight(item: NormalizedItem): number {
  const level = item.rawMetadata?.extractionLevel;
  if (level === 'article_full') return 3;
  if (level === 'article_partial') return 2;
  if (level === 'link_only') return 1;
  return 2;
}

function timestampWeight(item: NormalizedItem): number {
  const confidence = item.rawMetadata?.publishedAtConfidence ?? (item.published_at ? 'exact' : 'fallback_discovered_at');
  if (confidence === 'exact') return 2;
  if (confidence === 'derived') return 1;
  return 0;
}
```

Sort by:
1. extraction weight descending
2. timestamp confidence descending
3. published/fetched time descending

Keep the existing compatibility behavior of marking included items with `decision: 'include'`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/filtering/selectItems.webpageQuality.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filtering/selectItems.ts tests/filtering/selectItems.webpageQuality.test.ts
git commit -m "feat: weight webpage extraction quality in selection"
```

### Task 7: Preserve webpage metadata through normalization and rendering

**Files:**
- Modify: `src/normalize/normalizeItem.ts`
- Modify: `src/render/renderHtmlEmail.ts`

- [ ] **Step 1: Write the failing normalization/render regression test**

Add this test to `tests/render.test.ts` or create a focused regression file if that keeps the file smaller:

```ts
it('renders degraded webpage items without exposing internal extraction labels', () => {
  const html = renderHtmlEmail({
    date: new Date('2026-05-26T00:00:00.000Z'),
    subjectTemplate: 'AI Pulse Scout -- {date}',
    items: [
      {
        id: '1',
        source_name: 'Web Source',
        source_category: 'frontier-model-labs',
        source_url: 'https://example.com/blog',
        item_url: 'https://example.com/post-1',
        title: 'Post 1',
        published_at: null,
        fetched_at: new Date('2026-05-26T00:00:00.000Z'),
        author: '',
        content_text: '',
        summary: '',
        tags: [],
        content_type: 'article',
        fingerprint: 'fp-1',
        relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
        decision: 'include',
        decision_reason: 'included',
        primary_topic: 'AI News Roundup',
        rawMetadata: {
          extractionLevel: 'link_only',
          degradeReason: 'content_extraction_failed',
        },
      },
    ],
  });

  expect(html).toContain('Post 1');
  expect(html).not.toContain('link_only');
  expect(html).not.toContain('content_extraction_failed');
});
```

- [ ] **Step 2: Run the focused render test to verify it fails or is missing coverage**

Run: `npx vitest run tests/render.test.ts`
Expected: either FAIL or prove that normalization/rendering still needs an explicit metadata-safe path

- [ ] **Step 3: Preserve metadata in normalization and keep rendering user-clean**

In `src/normalize/normalizeItem.ts`, make sure any shared normalization path keeps `rawMetadata` rather than discarding it.

In `src/render/renderHtmlEmail.ts`, keep the displayed output user-friendly:

```ts
const summary = item.summary || item.content_text || '';
```

Do **not** render raw extraction labels or degrade reasons into the email body.

- [ ] **Step 4: Run the render test again**

Run: `npx vitest run tests/render.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/normalize/normalizeItem.ts src/render/renderHtmlEmail.ts tests/render.test.ts
git commit -m "fix: preserve webpage metadata without leaking internals"
```

### Task 8: Run targeted verification, then full verification

**Files:**
- Verify only

- [ ] **Step 1: Run the webpage-focused suite**

Run:

```bash
npx vitest run \
  tests/adapters/webpage/classifyEntryPage.test.ts \
  tests/adapters/webpage/extractCandidates.test.ts \
  tests/adapters/webpage/extractDetail.test.ts \
  tests/adapters/webpage/normalizeWebpageItem.test.ts \
  tests/adapters/genericWebAdapter.integration.test.ts \
  tests/filtering/selectItems.webpageQuality.test.ts \
  tests/render.test.ts
```

Expected: all listed tests PASS

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run`
Expected: PASS with 0 failures

- [ ] **Step 3: Run the production verification path**

Run: `npm run send-test`
Expected:
- command exits 0
- digest generation completes
- no crash from webpage metadata changes
- output HTML is written successfully

- [ ] **Step 4: Commit the final implementation batch if needed**

```bash
git status --short
git add src/adapters/webpage src/adapters/genericWebAdapter.ts src/filtering/selectItems.ts src/normalize/normalizeItem.ts src/render/renderHtmlEmail.ts src/types/item.ts src/ingest/types.ts tests/adapters/webpage tests/adapters/genericWebAdapter.integration.test.ts tests/filtering/selectItems.webpageQuality.test.ts tests/render.test.ts
git commit -m "feat: improve webpage extraction quality"
```

- [ ] **Step 5: Push the branch**

```bash
git push origin feature/ai-pulse-scout-mvp
```

## Self-Review

### Spec coverage
- Entry classification: covered by Task 1
- Candidate extraction: covered by Task 2
- Detail extraction: covered by Task 3
- Shared webpage normalization metadata: covered by Task 4
- Layered adapter orchestration: covered by Task 5
- Downstream selection weighting: covered by Task 6
- Rendering safety / compatibility: covered by Task 7
- Verification, full suite, and send-test: covered by Task 8

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders remain in the task steps.
- Each code-writing step includes concrete code or concrete structural instructions.
- Each verification step contains an exact command and expected result.

### Type consistency
- Shared metadata names are consistent across tasks:
  - `extractionLevel`
  - `candidateOrigin`
  - `degradeReason`
  - `publishedAtConfidence`
- Helper module names are consistent across tasks:
  - `classifyEntryPage`
  - `extractCandidates`
  - `extractDetail`
  - `normalizeWebpageItem`

