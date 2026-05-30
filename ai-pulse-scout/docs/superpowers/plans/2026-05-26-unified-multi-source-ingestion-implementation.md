# Unified Multi-Source Production Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the feed-only daily digest intake path with one unified production ingestion pipeline that supports RSS, webpage, YouTube, GitHub, docs, community, and papers sources through shared normalization and a source-agnostic downstream digest flow.

**Architecture:** Introduce a production `ingestAllSources()` entrypoint that dispatches enabled sources to adapter-specific ingestors, emits a shared normalized item schema, and then feeds one downstream digest flow for dedupe, ledger suppression, topic inference, insight generation, rendering, and email send. Land this in controlled waves so the current feed behavior stays stable while non-feed ingestion becomes first-class and support-state reporting becomes honest.

**Tech Stack:** TypeScript, Node.js, Vitest, existing AI Pulse Scout config/loading/render/state pipeline

---

## File Structure

### Existing files to modify
- `src/types/config.ts` — expand source types and support-state modeling used by config/runtime
- `src/types/item.ts` — extend normalized item shape for unified ingestion identity, provenance, and timestamp confidence
- `src/config/loadConfig.ts` — keep enabled-source loading but preserve richer type information for unified ingestion
- `src/jobs/runDailyDigest.ts` — switch daily production intake from feed-only fetching to unified ingestion
- `src/filtering/dedupeItems.ts` — dedupe mixed-source items using stable identity / canonical URL rules
- `src/state/ledger.ts` — ensure ledger keys remain stable across mixed source types
- `src/render/renderHtmlEmail.ts` — keep rendering source-agnostic while accepting normalized multi-source items
- `src/inbox/classifySource.ts` — align strategy mapping with production ingestion categories and support-state reporting
- `src/jobs/runSourceCoverage.ts` — reuse production-capable adapter contracts and expose honest support states
- `src/cli/coverage.ts` — surface updated support-state summary output
- `config/sources.yaml` — eventually enable non-feed sources after production support exists and is verified

### Existing files to split or heavily adapt
- `src/adapters/types.ts` — redefine adapter interfaces from coverage-count reporting to production item ingestion
- `src/adapters/feedAdapter.ts` — upgrade from coverage probe to production ingestor
- `src/adapters/genericWebAdapter.ts` — upgrade from discovery-only behavior to normalized webpage item ingestion
- `src/adapters/youtubeAdapter.ts` — upgrade from feed-resolution probe to production YouTube ingestion
- `src/adapters/githubAdapter.ts` — upgrade from release-feed probe to production GitHub release ingestion

### New files to create
- `src/ingest/types.ts` — unified ingestion result / diagnostics contracts
- `src/ingest/ingestAllSources.ts` — production entrypoint and adapter dispatch orchestration
- `src/ingest/identity.ts` — stable identity generation helpers
- `src/ingest/timestamps.ts` — timestamp confidence helpers and normalization rules
- `src/ingest/supportStatus.ts` — support-state helpers and labels
- `src/adapters/docsAdapter.ts` — production docs ingestion adapter
- `src/adapters/communityAdapter.ts` — production community ingestion adapter
- `src/adapters/papersAdapter.ts` — production papers ingestion adapter
- `src/adapters/shared/http.ts` — shared fetch helpers / timeouts / headers
- `src/adapters/shared/html.ts` — shared canonical URL extraction / link extraction helpers
- `tests/ingest/ingestAllSources.test.ts` — unified ingestion orchestration coverage
- `tests/ingest/identity.test.ts` — stable identity coverage
- `tests/ingest/timestamps.test.ts` — timestamp confidence coverage
- `tests/adapters/feedAdapter.test.ts` — production feed-ingestion behavior
- `tests/adapters/genericWebAdapter.test.ts` — production webpage-ingestion behavior
- `tests/adapters/youtubeAdapter.test.ts` — production YouTube-ingestion behavior
- `tests/adapters/githubAdapter.test.ts` — production GitHub-ingestion behavior
- `tests/adapters/docsAdapter.test.ts` — docs adapter significance behavior
- `tests/adapters/communityAdapter.test.ts` — community adapter destination/listing behavior
- `tests/adapters/papersAdapter.test.ts` — papers adapter metadata/abstract behavior
- `tests/jobs/runDailyDigest.unifiedIngestion.test.ts` — digest job uses unified ingestion instead of feed-only fetching
- `tests/coverage/supportStates.test.ts` — honest support-state reporting coverage

---

### Task 1: Lock the unified ingestion contract in tests

**Files:**
- Create: `tests/ingest/ingestAllSources.test.ts`
- Create: `tests/ingest/identity.test.ts`
- Create: `tests/ingest/timestamps.test.ts`
- Test: `tests/ingest/ingestAllSources.test.ts`, `tests/ingest/identity.test.ts`, `tests/ingest/timestamps.test.ts`

- [ ] **Step 1: Write failing orchestration tests for unified ingestion**

Create `tests/ingest/ingestAllSources.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ingestAllSources } from '../../src/ingest/ingestAllSources';
import type { SourceConfig } from '../../src/types/config';
import type { ProductionSourceAdapter } from '../../src/adapters/types';

function makeSource(partial: Partial<SourceConfig>): SourceConfig {
  return {
    name: partial.name ?? 'Example Source',
    category: partial.category ?? 'frontier-model-labs',
    url: partial.url ?? 'https://example.com',
    type: partial.type ?? 'webpage',
    enabled: partial.enabled ?? true,
  };
}

describe('ingestAllSources', () => {
  it('dispatches sources to matching production adapters and merges normalized items', async () => {
    const rssSource = makeSource({ name: 'RSS Source', type: 'rss', url: 'https://example.com/feed.xml' });
    const webpageSource = makeSource({ name: 'Web Source', type: 'webpage', url: 'https://example.com/blog' });

    const feedAdapter: ProductionSourceAdapter = {
      canHandle: (source) => source.type === 'rss',
      ingest: vi.fn(async (source) => ({
        source,
        status: 'production_supported',
        items: [
          {
            sourceType: 'rss',
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: 'https://example.com/feed-item',
            canonicalUrl: 'https://example.com/feed-item',
            title: 'Feed Item',
            publishedAt: '2026-05-26T00:00:00.000Z',
            publishedAtConfidence: 'exact',
            discoveredAt: '2026-05-26T00:05:00.000Z',
            content: 'Feed content',
            summaryMaterial: 'Feed content',
            stableIdentity: 'id:feed-item',
            topicHints: [],
            rawMetadata: {},
          },
        ],
        diagnostics: { attempted: 1, normalized: 1, dropped: 0 },
      })),
    };

    const webAdapter: ProductionSourceAdapter = {
      canHandle: (source) => source.type === 'webpage',
      ingest: vi.fn(async (source) => ({
        source,
        status: 'production_supported',
        items: [
          {
            sourceType: 'webpage',
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: 'https://example.com/blog/post-1',
            canonicalUrl: 'https://example.com/blog/post-1',
            title: 'Web Item',
            publishedAt: '2026-05-25T20:00:00.000Z',
            publishedAtConfidence: 'inferred',
            discoveredAt: '2026-05-26T00:05:00.000Z',
            content: 'Web content',
            summaryMaterial: 'Web content',
            stableIdentity: 'id:web-item',
            topicHints: ['AI Products & Platforms'],
            rawMetadata: { extractionMethod: 'article_html' },
          },
        ],
        diagnostics: { attempted: 1, normalized: 1, dropped: 0 },
      })),
    };

    const result = await ingestAllSources({
      sources: [rssSource, webpageSource],
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
      adapters: [feedAdapter, webAdapter],
    });

    expect(feedAdapter.ingest).toHaveBeenCalledOnce();
    expect(webAdapter.ingest).toHaveBeenCalledOnce();
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sourceType)).toEqual(['rss', 'webpage']);
    expect(result.summary.byStatus.production_supported).toBe(2);
  });

  it('marks unsupported sources honestly when no adapter can ingest them', async () => {
    const docsSource = makeSource({ name: 'Docs Source', type: 'docs', url: 'https://example.com/docs' });

    const result = await ingestAllSources({
      sources: [docsSource],
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
      adapters: [],
    });

    expect(result.items).toEqual([]);
    expect(result.results[0]?.status).toBe('broken');
    expect(result.results[0]?.diagnostics.reason).toContain('No production adapter');
  });
});
```

- [ ] **Step 2: Write failing identity tests**

Create `tests/ingest/identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStableIdentity } from '../../src/ingest/identity';

describe('buildStableIdentity', () => {
  it('prefers canonical URL when available', () => {
    expect(
      buildStableIdentity({
        canonicalUrl: 'https://example.com/post-1?ref=home',
        itemUrl: 'https://example.com/post-1?utm_source=rss',
        sourceUrl: 'https://example.com/blog',
        title: 'Post 1',
        publishedAt: '2026-05-25T00:00:00.000Z',
      }),
    ).toBe('url:https://example.com/post-1');
  });

  it('falls back to source-specific IDs when canonical URL is missing', () => {
    expect(
      buildStableIdentity({
        itemUrl: 'https://www.youtube.com/watch?v=abc123',
        sourceUrl: 'https://www.youtube.com/@Example',
        title: 'Video 1',
        publishedAt: '2026-05-25T00:00:00.000Z',
        sourceSpecificId: 'youtube:abc123',
      }),
    ).toBe('source-id:youtube:abc123');
  });
});
```

- [ ] **Step 3: Write failing timestamp-confidence tests**

Create `tests/ingest/timestamps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizePublishedAt } from '../../src/ingest/timestamps';

describe('normalizePublishedAt', () => {
  it('marks ISO timestamps as exact', () => {
    expect(normalizePublishedAt('2026-05-26T00:00:00.000Z')).toEqual({
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
    });
  });

  it('returns weak confidence when only a date is available', () => {
    expect(normalizePublishedAt('2026-05-26')).toEqual({
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'weak',
    });
  });

  it('returns unknown when timestamp is missing', () => {
    expect(normalizePublishedAt(undefined)).toEqual({
      publishedAt: null,
      publishedAtConfidence: 'unknown',
    });
  });
});
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/ingest/ingestAllSources.test.ts tests/ingest/identity.test.ts tests/ingest/timestamps.test.ts
```

Expected: FAIL because the new ingestion modules and production adapter contracts do not exist yet.

- [ ] **Step 5: Commit the test scaffold**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add tests/ingest/ingestAllSources.test.ts tests/ingest/identity.test.ts tests/ingest/timestamps.test.ts
git commit -m "test: add unified ingestion contract coverage"
```

### Task 2: Implement the core ingestion types, identity, and timestamp helpers

**Files:**
- Create: `src/ingest/types.ts`
- Create: `src/ingest/identity.ts`
- Create: `src/ingest/timestamps.ts`
- Modify: `src/types/item.ts`
- Modify: `src/adapters/types.ts`
- Test: `tests/ingest/ingestAllSources.test.ts`, `tests/ingest/identity.test.ts`, `tests/ingest/timestamps.test.ts`

- [ ] **Step 1: Define unified ingestion result types**

Create `src/ingest/types.ts`:

```ts
import type { SourceConfig } from '../types/config.js';

export type PublishedAtConfidence = 'exact' | 'inferred' | 'weak' | 'unknown';
export type ProductionSupportStatus =
  | 'production_supported'
  | 'partial_supported'
  | 'discoverable_only'
  | 'deferred'
  | 'broken';

export interface IngestionDiagnostics {
  attempted: number;
  normalized: number;
  dropped: number;
  reason?: string;
  adapterType?: string;
}

export interface IngestedItem {
  sourceType: string;
  sourceUrl: string;
  sourceName: string;
  itemUrl: string;
  canonicalUrl: string | null;
  title: string;
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
  discoveredAt: string;
  content: string;
  summaryMaterial: string;
  stableIdentity: string;
  topicHints: string[];
  rawMetadata: Record<string, unknown>;
}

export interface SourceIngestionResult {
  source: SourceConfig;
  status: ProductionSupportStatus;
  items: IngestedItem[];
  diagnostics: IngestionDiagnostics;
}

export interface IngestAllSourcesResult {
  items: IngestedItem[];
  results: SourceIngestionResult[];
  summary: {
    totalSources: number;
    totalItems: number;
    byStatus: Record<ProductionSupportStatus, number>;
  };
}
```

- [ ] **Step 2: Define stable identity helper**

Create `src/ingest/identity.ts`:

```ts
interface StableIdentityInput {
  canonicalUrl?: string | null;
  itemUrl?: string | null;
  sourceUrl: string;
  title: string;
  publishedAt?: string | null;
  sourceSpecificId?: string | null;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.searchParams.delete('utm_source');
  parsed.searchParams.delete('utm_medium');
  parsed.searchParams.delete('utm_campaign');
  parsed.searchParams.delete('ref');
  const normalized = parsed.toString();
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function buildStableIdentity(input: StableIdentityInput): string {
  if (input.canonicalUrl) {
    return `url:${normalizeUrl(input.canonicalUrl)}`;
  }

  if (input.sourceSpecificId) {
    return `source-id:${input.sourceSpecificId}`;
  }

  if (input.itemUrl) {
    return `url:${normalizeUrl(input.itemUrl)}`;
  }

  return `fallback:${input.sourceUrl}::${input.title}::${input.publishedAt ?? 'unknown'}`;
}
```

- [ ] **Step 3: Define timestamp normalization helper**

Create `src/ingest/timestamps.ts`:

```ts
import type { PublishedAtConfidence } from './types.js';

export function normalizePublishedAt(rawValue?: string | null): {
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
} {
  if (!rawValue) {
    return {
      publishedAt: null,
      publishedAtConfidence: 'unknown',
    };
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(rawValue)) {
    return {
      publishedAt: new Date(rawValue).toISOString(),
      publishedAtConfidence: 'exact',
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return {
      publishedAt: new Date(`${rawValue}T00:00:00.000Z`).toISOString(),
      publishedAtConfidence: 'weak',
    };
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      publishedAt: parsed.toISOString(),
      publishedAtConfidence: 'inferred',
    };
  }

  return {
    publishedAt: null,
    publishedAtConfidence: 'unknown',
  };
}
```

- [ ] **Step 4: Update normalized item and adapter contracts**

Update `src/types/item.ts` to re-export the unified ingestion item type or extend the current normalized item shape so downstream code can consume mixed-source items without ad hoc casting.

```ts
export type { IngestedItem as NormalizedItem } from '../ingest/types.js';
```

Update `src/adapters/types.ts`:

```ts
import type { SourceConfig } from '../types/config.js';
import type { SourceIngestionResult } from '../ingest/types.js';

export interface ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean;
  ingest(input: {
    source: SourceConfig;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<SourceIngestionResult>;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/ingest/ingestAllSources.test.ts tests/ingest/identity.test.ts tests/ingest/timestamps.test.ts
```

Expected: identity and timestamp tests PASS; orchestration test still FAIL because `ingestAllSources()` is not implemented yet.

- [ ] **Step 6: Commit the core contracts**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/ingest/types.ts src/ingest/identity.ts src/ingest/timestamps.ts src/types/item.ts src/adapters/types.ts
git commit -m "feat: add unified ingestion core contracts"
```

### Task 3: Implement the unified production ingestion orchestrator

**Files:**
- Create: `src/ingest/ingestAllSources.ts`
- Test: `tests/ingest/ingestAllSources.test.ts`

- [ ] **Step 1: Implement `ingestAllSources()`**

Create `src/ingest/ingestAllSources.ts`:

```ts
import type { ProductionSourceAdapter } from '../adapters/types.js';
import type { SourceConfig } from '../types/config.js';
import type {
  IngestAllSourcesResult,
  ProductionSupportStatus,
  SourceIngestionResult,
} from './types.js';

interface IngestAllSourcesInput {
  sources: SourceConfig[];
  windowStart: Date;
  windowEnd: Date;
  adapters: ProductionSourceAdapter[];
}

const ALL_STATUSES: ProductionSupportStatus[] = [
  'production_supported',
  'partial_supported',
  'discoverable_only',
  'deferred',
  'broken',
];

export async function ingestAllSources(
  input: IngestAllSourcesInput,
): Promise<IngestAllSourcesResult> {
  const results: SourceIngestionResult[] = [];

  for (const source of input.sources) {
    const adapter = input.adapters.find((candidate) => candidate.canHandle(source));

    if (!adapter) {
      results.push({
        source,
        status: 'broken',
        items: [],
        diagnostics: {
          attempted: 0,
          normalized: 0,
          dropped: 0,
          reason: `No production adapter for source type ${source.type}`,
        },
      });
      continue;
    }

    results.push(
      await adapter.ingest({
        source,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      }),
    );
  }

  const items = results.flatMap((result) => result.items);
  const byStatus = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<ProductionSupportStatus, number>;

  for (const result of results) {
    byStatus[result.status] += 1;
  }

  return {
    items,
    results,
    summary: {
      totalSources: input.sources.length,
      totalItems: items.length,
      byStatus,
    },
  };
}
```

- [ ] **Step 2: Run orchestration test**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/ingest/ingestAllSources.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the orchestrator**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/ingest/ingestAllSources.ts tests/ingest/ingestAllSources.test.ts
git commit -m "feat: add unified ingestion orchestrator"
```

### Task 4: Convert the feed adapter into a production ingestor

**Files:**
- Modify: `src/adapters/feedAdapter.ts`
- Create: `tests/adapters/feedAdapter.test.ts`
- Test: `tests/adapters/feedAdapter.test.ts`

- [ ] **Step 1: Write failing feed-ingestion test**

Create `tests/adapters/feedAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { FeedAdapter } from '../../src/adapters/feedAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Feed Source',
  category: 'frontier-model-labs',
  url: 'https://example.com/feed.xml',
  type: 'rss',
  enabled: true,
};

describe('FeedAdapter', () => {
  it('normalizes fetched feed items into production ingestion items', async () => {
    const adapter = new FeedAdapter({
      fetchFeedItems: vi.fn(async () => [
        {
          sourceType: 'rss',
          sourceUrl: source.url,
          sourceName: source.name,
          itemUrl: 'https://example.com/post-1',
          canonicalUrl: 'https://example.com/post-1',
          title: 'Post 1',
          publishedAt: '2026-05-26T00:00:00.000Z',
          publishedAtConfidence: 'exact',
          discoveredAt: '2026-05-26T00:01:00.000Z',
          content: 'Body',
          summaryMaterial: 'Body',
          stableIdentity: 'url:https://example.com/post-1',
          topicHints: [],
          rawMetadata: {},
        },
      ]),
    });

    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('production_supported');
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics.normalized).toBe(1);
  });
});
```

- [ ] **Step 2: Implement production `FeedAdapter`**

Update `src/adapters/feedAdapter.ts` so it uses the current feed-fetching logic to emit `SourceIngestionResult` instead of only discovery counts.

Implementation shape:

```ts
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { buildStableIdentity } from '../ingest/identity.js';
import { normalizePublishedAt } from '../ingest/timestamps.js';
import type { ProductionSourceAdapter } from './types.js';
import type { IngestedItem, SourceIngestionResult } from '../ingest/types.js';

export class FeedAdapter implements ProductionSourceAdapter {
  constructor(
    private readonly deps: {
      fetchFeedItems?: (input: {
        source: any;
        windowStart: Date;
        windowEnd: Date;
      }) => Promise<IngestedItem[]>;
    } = {},
  ) {}

  canHandle(source: any): boolean {
    return source.type === 'rss' || source.type === 'atom' || source.type === 'podcast';
  }

  async ingest({ source, windowStart, windowEnd }: { source: any; windowStart: Date; windowEnd: Date; }): Promise<SourceIngestionResult> {
    const items = this.deps.fetchFeedItems
      ? await this.deps.fetchFeedItems({ source, windowStart, windowEnd })
      : (await fetchRssSource(source, windowStart, windowEnd)).items.map((item) => {
          const published = normalizePublishedAt(item.published_at);
          return {
            sourceType: source.type,
            sourceUrl: source.url,
            sourceName: source.name,
            itemUrl: item.url,
            canonicalUrl: item.url,
            title: item.title,
            publishedAt: published.publishedAt,
            publishedAtConfidence: published.publishedAtConfidence,
            discoveredAt: new Date().toISOString(),
            content: item.content,
            summaryMaterial: item.content,
            stableIdentity: buildStableIdentity({
              canonicalUrl: item.url,
              itemUrl: item.url,
              sourceUrl: source.url,
              title: item.title,
              publishedAt: published.publishedAt,
            }),
            topicHints: [],
            rawMetadata: {
              sourceCategory: source.category,
            },
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
        adapterType: 'feed',
      },
    };
  }
}
```

- [ ] **Step 3: Run feed adapter test**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/adapters/feedAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit feed ingestion support**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/adapters/feedAdapter.ts tests/adapters/feedAdapter.test.ts
git commit -m "feat: convert feed adapter to production ingestion"
```

### Task 5: Convert webpage, YouTube, and GitHub adapters into production ingestors

**Files:**
- Modify: `src/adapters/genericWebAdapter.ts`
- Modify: `src/adapters/youtubeAdapter.ts`
- Modify: `src/adapters/githubAdapter.ts`
- Create: `src/adapters/shared/http.ts`
- Create: `src/adapters/shared/html.ts`
- Create: `tests/adapters/genericWebAdapter.test.ts`
- Create: `tests/adapters/youtubeAdapter.test.ts`
- Create: `tests/adapters/githubAdapter.test.ts`
- Test: `tests/adapters/genericWebAdapter.test.ts`, `tests/adapters/youtubeAdapter.test.ts`, `tests/adapters/githubAdapter.test.ts`

- [ ] **Step 1: Write failing webpage-ingestion test**

Create `tests/adapters/genericWebAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractRecentArticleLinksFromHtml } from '../../src/adapters/genericWebAdapter';

describe('GenericWebAdapter', () => {
  it('extracts likely article links from an index page', () => {
    const html = `
      <html>
        <body>
          <a href="/blog/post-1">Post 1</a>
          <a href="/about">About</a>
          <a href="https://example.com/news/post-2">Post 2</a>
        </body>
      </html>
    `;

    expect(extractRecentArticleLinksFromHtml('https://example.com', html)).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/news/post-2',
    ]);
  });
});
```

- [ ] **Step 2: Write failing YouTube-ingestion test**

Create `tests/adapters/youtubeAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveYouTubeSource } from '../../src/adapters/youtubeAdapter';

describe('YouTubeAdapter', () => {
  it('resolves known channel URLs to feed URLs', () => {
    expect(resolveYouTubeSource('https://www.youtube.com/@IBMTechnology')).toEqual({
      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9x0AN7BWHpCDHSm9NiJFJQ',
      strategy: 'youtube_channel_resolution',
    });
  });
});
```

- [ ] **Step 3: Write failing GitHub-ingestion test**

Create `tests/adapters/githubAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveGitHubSource } from '../../src/adapters/githubAdapter';

describe('GitHubAdapter', () => {
  it('converts repository URLs into releases feeds', () => {
    expect(resolveGitHubSource('https://github.com/openai/openai-cookbook')).toEqual({
      url: 'https://github.com/openai/openai-cookbook/releases.atom',
      strategy: 'github_release_feed',
    });
  });
});
```

- [ ] **Step 4: Implement shared HTTP and HTML helpers**

Create `src/adapters/shared/http.ts`:

```ts
export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AI-Pulse-Scout/0.1; +https://github.com/deeloovo-cell/ai-pulse-scout)',
      },
    });

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
```

Create `src/adapters/shared/html.ts`:

```ts
export function resolveUrl(baseUrl: string, maybeRelative: string): string {
  return new URL(maybeRelative, baseUrl).toString();
}

export function extractCanonicalUrl(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? match[1] : null;
}
```

- [ ] **Step 5: Upgrade the three adapters to production ingestion contracts**

Implement the following behaviors:
- `GenericWebAdapter` returns normalized article items when feed links or article links are found; use `partial_supported` when only discovery-level extraction is available.
- `YouTubeAdapter` resolves known channel URLs into feed URLs and returns normalized video items with stable video identities.
- `GitHubAdapter` resolves repository URLs into releases feeds and returns normalized release items.

Implementation details to include:
- use `buildStableIdentity()` for identity
- use `normalizePublishedAt()` for timestamps
- populate `rawMetadata.adapterType`
- return `SourceIngestionResult`
- use `partial_supported` instead of pretending a weak webpage extraction is full support

- [ ] **Step 6: Run the adapter tests**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/adapters/genericWebAdapter.test.ts tests/adapters/youtubeAdapter.test.ts tests/adapters/githubAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit first-wave non-feed ingestion**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/adapters/genericWebAdapter.ts src/adapters/youtubeAdapter.ts src/adapters/githubAdapter.ts src/adapters/shared/http.ts src/adapters/shared/html.ts tests/adapters/genericWebAdapter.test.ts tests/adapters/youtubeAdapter.test.ts tests/adapters/githubAdapter.test.ts
git commit -m "feat: add first-wave non-feed production ingestion"
```

### Task 6: Add docs, community, and papers production adapters

**Files:**
- Create: `src/adapters/docsAdapter.ts`
- Create: `src/adapters/communityAdapter.ts`
- Create: `src/adapters/papersAdapter.ts`
- Create: `tests/adapters/docsAdapter.test.ts`
- Create: `tests/adapters/communityAdapter.test.ts`
- Create: `tests/adapters/papersAdapter.test.ts`
- Test: `tests/adapters/docsAdapter.test.ts`, `tests/adapters/communityAdapter.test.ts`, `tests/adapters/papersAdapter.test.ts`

- [ ] **Step 1: Write failing docs-adapter test**

Create `tests/adapters/docsAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DocsAdapter } from '../../src/adapters/docsAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Docs Source',
  category: 'developer-tools',
  url: 'https://example.com/docs',
  type: 'docs',
  enabled: true,
};

describe('DocsAdapter', () => {
  it('returns partial support when no meaningful doc changes are detected yet', async () => {
    const adapter = new DocsAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('significance');
  });
});
```

- [ ] **Step 2: Write failing community-adapter test**

Create `tests/adapters/communityAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommunityAdapter } from '../../src/adapters/communityAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Community Source',
  category: 'community-signals',
  url: 'https://news.ycombinator.com/',
  type: 'community',
  enabled: true,
};

describe('CommunityAdapter', () => {
  it('returns partial support when listing-only discovery exists without destination ingestion', async () => {
    const adapter = new CommunityAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('listing');
  });
});
```

- [ ] **Step 3: Write failing papers-adapter test**

Create `tests/adapters/papersAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PapersAdapter } from '../../src/adapters/papersAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Papers Source',
  category: 'research',
  url: 'https://arxiv.org/list/cs.AI/recent',
  type: 'papers',
  enabled: true,
};

describe('PapersAdapter', () => {
  it('returns partial support until metadata extraction is implemented', async () => {
    const adapter = new PapersAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('metadata');
  });
});
```

- [ ] **Step 4: Implement the three adapters with honest partial-support behavior**

Create `src/adapters/docsAdapter.ts`, `src/adapters/communityAdapter.ts`, and `src/adapters/papersAdapter.ts` so each one implements `ProductionSourceAdapter` and returns a truthful `partial_supported` result with zero items until its deeper extraction logic is implemented.

Implementation shape for each adapter:

```ts
import type { ProductionSourceAdapter } from './types.js';
import type { SourceIngestionResult } from '../ingest/types.js';

export class DocsAdapter implements ProductionSourceAdapter {
  canHandle(source: any): boolean {
    return source.type === 'docs';
  }

  async ingest({ source }: { source: any }): Promise<SourceIngestionResult> {
    return {
      source,
      status: 'partial_supported',
      items: [],
      diagnostics: {
        attempted: 1,
        normalized: 0,
        dropped: 0,
        adapterType: 'docs',
        reason: 'Docs significance-aware change extraction is not implemented yet.',
      },
    };
  }
}
```

Use analogous implementations for `CommunityAdapter` and `PapersAdapter` with reasons containing `listing` and `metadata` respectively.

- [ ] **Step 5: Run the adapter tests**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/adapters/docsAdapter.test.ts tests/adapters/communityAdapter.test.ts tests/adapters/papersAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit second-wave adapter scaffolding**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/adapters/docsAdapter.ts src/adapters/communityAdapter.ts src/adapters/papersAdapter.ts tests/adapters/docsAdapter.test.ts tests/adapters/communityAdapter.test.ts tests/adapters/papersAdapter.test.ts
git commit -m "feat: add honest partial-support adapters for docs community and papers"
```

### Task 7: Switch the daily digest job to unified ingestion

**Files:**
- Modify: `src/jobs/runDailyDigest.ts`
- Create: `tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
- Test: `tests/jobs/runDailyDigest.unifiedIngestion.test.ts`

- [ ] **Step 1: Write failing digest-job test**

Create `tests/jobs/runDailyDigest.unifiedIngestion.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ingest/ingestAllSources', () => ({
  ingestAllSources: vi.fn(async () => ({
    items: [
      {
        sourceType: 'webpage',
        sourceUrl: 'https://example.com/blog',
        sourceName: 'Web Source',
        itemUrl: 'https://example.com/blog/post-1',
        canonicalUrl: 'https://example.com/blog/post-1',
        title: 'Web Item',
        publishedAt: '2026-05-26T00:00:00.000Z',
        publishedAtConfidence: 'exact',
        discoveredAt: '2026-05-26T00:01:00.000Z',
        content: 'Body',
        summaryMaterial: 'Body',
        stableIdentity: 'url:https://example.com/blog/post-1',
        topicHints: [],
        rawMetadata: {},
      },
    ],
    results: [],
    summary: {
      totalSources: 1,
      totalItems: 1,
      byStatus: {
        production_supported: 1,
        partial_supported: 0,
        discoverable_only: 0,
        deferred: 0,
        broken: 0,
      },
    },
  })),
}));

describe('runDailyDigest unified ingestion', () => {
  it('uses unified ingestion items instead of feed-only fetch results', async () => {
    const module = await import('../../src/jobs/runDailyDigest');
    const result = await module.runDailyDigest();
    expect(result.totalFetched).toBe(1);
  });
});
```

- [ ] **Step 2: Update `runDailyDigest()` to use unified ingestion**

Modify `src/jobs/runDailyDigest.ts` so that after computing `windowStart` and `windowEnd`, it:
- loads config
- constructs production adapters
- calls `ingestAllSources({ sources: config.sources, windowStart, windowEnd, adapters })`
- uses `ingestion.items` as the candidate stream instead of direct `fetchAllSources()` results
- logs ingestion summary by support status

Implementation shape to introduce:

```ts
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';

const ingestion = await ingestAllSources({
  sources: config.sources,
  windowStart,
  windowEnd,
  adapters: [
    new FeedAdapter(),
    new GenericWebAdapter(),
    new YouTubeAdapter(),
    new GitHubAdapter(),
    new DocsAdapter(),
    new CommunityAdapter(),
    new PapersAdapter(),
  ],
});

const allItems = ingestion.items;
logger.info(`Unified ingestion fetched ${allItems.length} items across ${ingestion.summary.totalSources} sources`);
```

- [ ] **Step 3: Run digest-job test**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/jobs/runDailyDigest.unifiedIngestion.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit unified digest integration**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/jobs/runDailyDigest.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts
git commit -m "feat: route daily digest through unified ingestion"
```

### Task 8: Make dedupe, ledger, and support reporting honest for mixed sources

**Files:**
- Modify: `src/filtering/dedupeItems.ts`
- Modify: `src/state/ledger.ts`
- Modify: `src/jobs/runSourceCoverage.ts`
- Modify: `src/cli/coverage.ts`
- Create: `tests/coverage/supportStates.test.ts`
- Test: `tests/coverage/supportStates.test.ts`

- [ ] **Step 1: Write failing support-state test**

Create `tests/coverage/supportStates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarizeSupportStates } from '../../src/ingest/supportStatus';

describe('summarizeSupportStates', () => {
  it('counts production and partial support separately', () => {
    expect(
      summarizeSupportStates([
        { status: 'production_supported' },
        { status: 'partial_supported' },
        { status: 'broken' },
      ]),
    ).toEqual({
      production_supported: 1,
      partial_supported: 1,
      discoverable_only: 0,
      deferred: 0,
      broken: 1,
    });
  });
});
```

- [ ] **Step 2: Implement support-state summarizer**

Create `src/ingest/supportStatus.ts`:

```ts
import type { ProductionSupportStatus } from './types.js';

const ALL_STATUSES: ProductionSupportStatus[] = [
  'production_supported',
  'partial_supported',
  'discoverable_only',
  'deferred',
  'broken',
];

export function summarizeSupportStates(
  results: Array<{ status: ProductionSupportStatus }>,
): Record<ProductionSupportStatus, number> {
  const summary = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<ProductionSupportStatus, number>;

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}
```

- [ ] **Step 3: Update dedupe and ledger to use stable identities**

Modify `src/filtering/dedupeItems.ts` and `src/state/ledger.ts` so both treat `stableIdentity` as the primary key.

Implementation rule:
- if `stableIdentity` exists, use it
- otherwise fall back to legacy URL-based keys for backward compatibility

Expected code shape:

```ts
const key = item.stableIdentity ?? item.url;
```

Apply this in:
- in-memory dedupe set creation
- sent-ledger append/read key derivation

- [ ] **Step 4: Update coverage reporting to use honest support states**

Modify `src/jobs/runSourceCoverage.ts` and `src/cli/coverage.ts` so coverage output reports the new support-state model instead of collapsing everything into simplistic discover/remove outcomes.

- [ ] **Step 5: Run the support-state test and relevant existing tests**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/coverage/supportStates.test.ts tests/sourceCoverage.test.ts tests/backfill.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit mixed-source support honesty updates**

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add src/ingest/supportStatus.ts src/filtering/dedupeItems.ts src/state/ledger.ts src/jobs/runSourceCoverage.ts src/cli/coverage.ts tests/coverage/supportStates.test.ts
git commit -m "feat: add mixed-source support state reporting"
```

### Task 9: Verify the unified ingestion rollout end-to-end

**Files:**
- Modify: none unless fixes are required
- Test: existing and new test suite

- [ ] **Step 1: Run targeted adapter and ingestion tests**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run \
  tests/ingest/ingestAllSources.test.ts \
  tests/ingest/identity.test.ts \
  tests/ingest/timestamps.test.ts \
  tests/adapters/feedAdapter.test.ts \
  tests/adapters/genericWebAdapter.test.ts \
  tests/adapters/youtubeAdapter.test.ts \
  tests/adapters/githubAdapter.test.ts \
  tests/adapters/docsAdapter.test.ts \
  tests/adapters/communityAdapter.test.ts \
  tests/adapters/papersAdapter.test.ts \
  tests/jobs/runDailyDigest.unifiedIngestion.test.ts \
  tests/coverage/supportStates.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the broader regression suite**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run
```

Expected: PASS with no regressions in existing digest/date-window tests.

- [ ] **Step 3: Run a dry production send path check**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npm run send-test
```

Expected:
- unified ingestion logs show source counts by support state
- mixed-source items can be selected when present
- no crash in ledger/render/send flow

- [ ] **Step 4: Commit final verification-only changes if any were needed**

If verification required code edits:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
git add <files>
git commit -m "fix: stabilize unified ingestion rollout"
```

If no edits were required, do not create an extra commit.
