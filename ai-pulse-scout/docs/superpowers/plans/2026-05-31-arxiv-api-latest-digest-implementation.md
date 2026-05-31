# arXiv API 最新日报实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current empty arXiv RSS item path with arXiv API-backed latest-item ingestion so `npm run site:export -- --date 2026-05-31` produces a non-empty static digest page using the existing arXiv-only 18-source configuration.

**Architecture:** Keep `config/source-inbox.md` and `config/sources.yaml` unchanged, but route arXiv category sources through a new arXiv API fetch/parse module that emits existing normalized digest items. Reuse the current ingest, dedupe, selection, enrichment, and static export pipeline so the behavior change is isolated to the arXiv ingestion layer.

**Tech Stack:** TypeScript, tsx, Vitest, existing AI Pulse Scout ingest pipeline, XML/Atom parsing via platform-safe utilities already available in the repo or minimal string/XML parsing.

---

## File Map

- Create: `src/adapters/arxivApi.ts` — fetch and parse arXiv API results for a category query
- Modify: `src/adapters/papersAdapter.ts` — detect arXiv category sources and use the API-backed path
- Modify: `src/types/item.ts` — only if needed for stable metadata mapping; avoid changes unless required
- Test: `tests/adapters/arxivApi.test.ts` — parsing, category extraction, and window filtering coverage
- Test: `tests/adapters/papersAdapter.test.ts` — adapter integration for arXiv API-backed sources
- Test: `tests/static/exportStaticSite.test.ts` — ensure non-empty export path works with injected arXiv-like items if needed

### Task 1: Add failing tests for arXiv API category extraction and parsing

**Files:**
- Create: `tests/adapters/arxivApi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { extractArxivCategoryFromSourceUrl, parseArxivApiResponse } from '../../src/adapters/arxivApi';

describe('extractArxivCategoryFromSourceUrl', () => {
  it('extracts category names from arxiv rss source urls', () => {
    expect(extractArxivCategoryFromSourceUrl('https://arxiv.org/rss/cs.AI')).toBe('cs.AI');
    expect(extractArxivCategoryFromSourceUrl('https://arxiv.org/rss/stat.ML')).toBe('stat.ML');
  });
});

describe('parseArxivApiResponse', () => {
  it('parses arxiv atom entries into structured records', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>http://arxiv.org/abs/2605.99999v1</id>
        <updated>2026-05-31T03:00:00Z</updated>
        <published>2026-05-31T02:30:00Z</published>
        <title>API Paper Title</title>
        <summary>Paper summary text.</summary>
        <author><name>Author One</name></author>
        <category term="cs.AI" />
        <link href="http://arxiv.org/abs/2605.99999v1" rel="alternate" type="text/html" />
      </entry>
    </feed>`;

    const entries = parseArxivApiResponse(xml);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: '2605.99999v1',
      title: 'API Paper Title',
      summary: 'Paper summary text.',
      primaryCategory: 'cs.AI',
      canonicalUrl: 'https://arxiv.org/abs/2605.99999v1',
    });
    expect(entries[0].publishedAt.toISOString()).toBe('2026-05-31T02:30:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/arxivApi.test.ts`
Expected: FAIL with missing module/function errors for `src/adapters/arxivApi.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ArxivApiEntry {
  id: string;
  title: string;
  summary: string;
  publishedAt: Date;
  updatedAt: Date;
  primaryCategory: string;
  canonicalUrl: string;
}

export function extractArxivCategoryFromSourceUrl(url: string): string | null {
  const match = url.match(/\/rss\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseArxivApiResponse(xml: string): ArxivApiEntry[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);
  return entries.map((entryXml) => {
    const readTag = (tag: string) => {
      const match = entryXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim().replace(/\s+/g, ' ') : '';
    };
    const idUrl = readTag('id');
    const id = idUrl.split('/').pop() ?? idUrl;
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]+)"/);
    return {
      id,
      title: readTag('title'),
      summary: readTag('summary'),
      publishedAt: new Date(readTag('published')),
      updatedAt: new Date(readTag('updated')),
      primaryCategory: categoryMatch?.[1] ?? '',
      canonicalUrl: `https://arxiv.org/abs/${id}`,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/arxivApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/adapters/arxivApi.test.ts src/adapters/arxivApi.ts
git commit -m "test: add arxiv api parser coverage"
```

### Task 2: Add failing tests for PapersAdapter arXiv API-backed ingestion

**Files:**
- Modify: `tests/adapters/papersAdapter.test.ts`
- Modify: `src/adapters/papersAdapter.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { PapersAdapter } from '../../src/adapters/papersAdapter';

vi.mock('../../src/adapters/arxivApi', () => ({
  extractArxivCategoryFromSourceUrl: (url: string) => url.split('/').pop(),
  fetchArxivApiEntries: vi.fn(async () => [
    {
      id: '2605.99999v1',
      title: 'API Paper Title',
      summary: 'Paper summary text.',
      publishedAt: new Date('2026-05-31T02:30:00Z'),
      updatedAt: new Date('2026-05-31T03:00:00Z'),
      primaryCategory: 'cs.AI',
      canonicalUrl: 'https://arxiv.org/abs/2605.99999v1',
    },
  ]),
}));

describe('PapersAdapter', () => {
  it('ingests arxiv category sources through the arxiv api path', async () => {
    const adapter = new PapersAdapter();
    const items = await adapter.fetch({
      id: 'arxiv-cs-ai',
      name: 'arXiv CS.AI',
      type: 'rss',
      category: 'research',
      url: 'https://arxiv.org/rss/cs.AI',
      enabled: true,
      coverage_status: 'live',
    }, {
      windowStart: new Date('2026-05-31T00:00:00Z'),
      windowEnd: new Date('2026-06-01T00:00:00Z'),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'API Paper Title',
      source_name: 'arXiv CS.AI',
      item_url: 'https://arxiv.org/abs/2605.99999v1',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/papersAdapter.test.ts`
Expected: FAIL because `PapersAdapter` does not yet use `fetchArxivApiEntries`

- [ ] **Step 3: Write minimal implementation**

```ts
import { extractArxivCategoryFromSourceUrl, fetchArxivApiEntries } from './arxivApi.js';

const category = extractArxivCategoryFromSourceUrl(source.url);
if (category) {
  const entries = await fetchArxivApiEntries(category, options.windowStart, options.windowEnd);
  return entries.map((entry) => ({
    id: `arxiv:${entry.id}`,
    source_name: source.name,
    source_url: source.url,
    item_url: entry.canonicalUrl,
    title: entry.title,
    content_text: entry.summary,
    summary: entry.summary,
    published_at: entry.publishedAt,
    fingerprint: `arxiv:${entry.id}`,
    tags: [entry.primaryCategory],
    primary_topic: 'research',
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/papersAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/adapters/papersAdapter.test.ts src/adapters/papersAdapter.ts
git commit -m "feat: route arxiv sources through api-backed papers adapter"
```

### Task 3: Implement arXiv API fetching with window filtering

**Files:**
- Modify: `src/adapters/arxivApi.ts`
- Test: `tests/adapters/arxivApi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchArxivApiEntries } from '../../src/adapters/arxivApi';

describe('fetchArxivApiEntries', () => {
  it('filters api entries to the requested window', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>http://arxiv.org/abs/2605.10000v1</id>
          <updated>2026-05-31T03:00:00Z</updated>
          <published>2026-05-31T02:30:00Z</published>
          <title>Inside Window</title>
          <summary>Inside.</summary>
          <author><name>A</name></author>
          <category term="cs.AI" />
        </entry>
        <entry>
          <id>http://arxiv.org/abs/2605.10001v1</id>
          <updated>2026-05-30T03:00:00Z</updated>
          <published>2026-05-30T02:30:00Z</published>
          <title>Outside Window</title>
          <summary>Outside.</summary>
          <author><name>B</name></author>
          <category term="cs.AI" />
        </entry>
      </feed>`, { status: 200 })) as any);

    const entries = await fetchArxivApiEntries(
      'cs.AI',
      new Date('2026-05-31T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
    );

    expect(entries.map((entry) => entry.title)).toEqual(['Inside Window']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/arxivApi.test.ts`
Expected: FAIL because `fetchArxivApiEntries` does not exist or does not filter correctly

- [ ] **Step 3: Write minimal implementation**

```ts
export async function fetchArxivApiEntries(category: string, windowStart: Date, windowEnd: Date): Promise<ArxivApiEntry[]> {
  const query = new URL('https://export.arxiv.org/api/query');
  query.searchParams.set('search_query', `cat:${category}`);
  query.searchParams.set('sortBy', 'submittedDate');
  query.searchParams.set('sortOrder', 'descending');
  query.searchParams.set('start', '0');
  query.searchParams.set('max_results', '50');

  const response = await fetch(query);
  if (!response.ok) {
    throw new Error(`arXiv API request failed for ${category}: ${response.status}`);
  }

  const xml = await response.text();
  return parseArxivApiResponse(xml).filter((entry) => entry.publishedAt >= windowStart && entry.publishedAt < windowEnd);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/adapters/arxivApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/adapters/arxivApi.test.ts src/adapters/arxivApi.ts
git commit -m "feat: add arxiv api fetching with window filtering"
```

### Task 4: Verify static export produces non-empty output with arXiv API-backed items

**Files:**
- Modify: `tests/static/exportStaticSite.test.ts`
- Modify: `src/static/exportStaticSite.ts` only if required by test integration

- [ ] **Step 1: Write the failing test**

```ts
it('writes day and index pages containing digest items', async () => {
  const result = await exportStaticSite({
    outputDir: tempDir,
    currentDigest: {
      date: '2026-05-31',
      items: [
        {
          title: 'API Paper Title',
          item_url: 'https://arxiv.org/abs/2605.99999v1',
          source_name: 'arXiv CS.AI',
          summary: 'Paper summary text.',
        },
      ],
    },
    recentDigests: [],
  });

  expect(readFileSync(result.indexPath, 'utf8')).toContain('API Paper Title');
  expect(readFileSync(result.dayPath, 'utf8')).toContain('https://arxiv.org/abs/2605.99999v1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/static/exportStaticSite.test.ts`
Expected: FAIL only if the current render/export path still misses required fields for real arXiv items

- [ ] **Step 3: Write minimal implementation**

```ts
// Only if needed: ensure renderStaticSite/exportStaticSite reads title, item_url,
// source_name, and summary from normalized digest items without relying on review-app-only fields.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/static/exportStaticSite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/static/exportStaticSite.test.ts src/static/exportStaticSite.ts src/static/renderStaticSite.ts
git commit -m "test: verify static export renders real arxiv digest items"
```

### Task 5: Run end-to-end verification for 2026-05-31 real-content export

**Files:**
- Modify: none expected unless verification reveals an implementation bug

- [ ] **Step 1: Run focused adapter and static tests**

Run: `npx vitest run tests/adapters/arxivApi.test.ts tests/adapters/papersAdapter.test.ts tests/static/exportStaticSite.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS with all test files green

- [ ] **Step 3: Run real export for 2026-05-31**

Run: `LOG_LEVEL=quiet npm run site:export -- --date 2026-05-31`
Expected: CLI reports `Items:` greater than `0`

- [ ] **Step 4: Verify generated files contain real arXiv content**

Run:

```bash
rg -n "arxiv.org/abs|<article|API Paper Title|关键信息" data/output/site/index.html data/output/site/days/2026-05-31.html
```

Expected: matches include real arXiv paper links/content and not only the empty-state copy

- [ ] **Step 5: Commit final implementation**

```bash
git add src/adapters/arxivApi.ts src/adapters/papersAdapter.ts tests/adapters/arxivApi.test.ts tests/adapters/papersAdapter.test.ts tests/static/exportStaticSite.test.ts data/output/site/index.html data/output/site/days/2026-05-31.html
git commit -m "feat: generate static digest from arxiv api latest items"
```

---

## Self-Review Notes

- Spec coverage: plan covers API-backed arXiv ingestion, window filtering, adapter integration, static export verification, and end-to-end 2026-05-31 validation.
- Placeholder scan: one minimal implementation note remains intentionally conditional in Task 4 because existing export tests may already pass; during execution, only modify static render files if the failing test demonstrates an actual field mismatch.
- Type consistency: all tasks consistently use `extractArxivCategoryFromSourceUrl`, `parseArxivApiResponse`, and `fetchArxivApiEntries` in `src/adapters/arxivApi.ts`.
