# Phase 2 Review Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private single-user review website that renders the same final digest items as the scheduled email pipeline in a rolling 5-day feed, with persisted rating and follow-up state.

**Architecture:** Keep the existing digest selection pipeline as the source of truth, persist a stable snapshot of final digest items for website consumption, and add a small web app/API layer backed by SQLite. The website reads the last 5 days of final digest snapshots, renders a single chronological feed, and saves single-user review interactions without introducing a second selection path.

**Tech Stack:** Node.js, TypeScript, SQLite via `better-sqlite3`, existing AI Pulse Scout pipeline, Vitest, lightweight HTTP server/UI rendered from project code.

---

## File Structure

### Existing files to modify
- `src/jobs/runDailyDigest.ts`
  - extend final digest flow to persist website-readable final item snapshots from the same final selected item set used for email output
- `src/state/schema.ts`
  - add schema for digest review snapshots and persisted review state
- `src/state/db.ts`
  - ensure new website tables are initialized alongside current pipeline DB setup
- `src/types/item.ts`
  - reuse or minimally extend item-facing types needed by the website projection layer
- `package.json`
  - add website run/dev script(s) if needed
- `tests/jobs/runDailyDigest.pipeline.test.ts`
  - verify final digest items are persisted for website consumption without drifting from email item selection

### New source files to create
- `src/state/reviewRepository.ts`
  - query rolling 5-day review items and upsert persisted review state
- `src/web/reviewTypes.ts`
  - define UI/API response types for review items and update payloads
- `src/web/reviewService.ts`
  - build the website-facing review item list by joining digest snapshots with saved review state
- `src/web/renderReviewPage.ts`
  - render the private review website HTML shell and feed markup
- `src/web/reviewServer.ts`
  - provide routes for page render, review item data, rating update, and follow-up update
- `src/cli/reviewServer.ts`
  - CLI entry point to start the website locally

### New test files to create
- `tests/state/reviewRepository.test.ts`
  - repository tests for snapshot persistence, rolling-window queries, and saved review state
- `tests/web/reviewService.test.ts`
  - verify 5-day filtering, ascending ordering, and merged persisted review state
- `tests/web/renderReviewPage.test.ts`
  - verify empty state and card rendering assumptions
- `tests/web/reviewServer.test.ts`
  - API and page-route tests including validation failures and persistence behavior

---

### Task 1: Add database schema for review snapshots and saved interactions

**Files:**
- Modify: `src/state/schema.ts`
- Modify: `src/state/db.ts`
- Test: `tests/state/reviewRepository.test.ts`

- [ ] **Step 1: Write the failing schema/repository test**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb } from '../../src/state/db.js';
import { initializePipelineSchema } from '../../src/state/schema.js';
import { listReviewItemsWindow, saveDigestReviewItems, upsertItemReview } from '../../src/state/reviewRepository.js';

describe('reviewRepository', () => {
  it('stores digest review snapshots and single-user review state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        {
          itemKey: 'item-1',
          publishedAt: '2026-05-29T10:00:00.000Z',
          title: 'Alpha item',
          excerpt: 'Alpha excerpt',
          itemUrl: 'https://example.com/a',
          sourceName: 'Example',
          topicTags: ['AI'],
          matchScore: 0.92,
          normalizedItemJson: '{"id":"item-1"}',
        },
      ],
    });

    upsertItemReview(db, { itemKey: 'item-1', rating: 4, followUp: true });

    const items = listReviewItemsWindow(db, {
      startDigestDate: '2026-05-26',
      endDigestDate: '2026-05-30',
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemKey: 'item-1',
      rating: 4,
      followUp: true,
      topicTags: ['AI'],
      matchScore: 0.92,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/reviewRepository.test.ts`
Expected: FAIL because `reviewRepository.ts` exports do not exist and/or new tables are missing.

- [ ] **Step 3: Write minimal schema and repository implementation**

```ts
// src/state/schema.ts
export function initializePipelineSchema(db: PipelineDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS digest_review_items (
      digest_date TEXT NOT NULL,
      run_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      published_at TEXT,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      item_url TEXT,
      source_name TEXT,
      topic_tags_json TEXT NOT NULL,
      match_score REAL NOT NULL DEFAULT 0,
      normalized_item_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (digest_date, item_key)
    );

    CREATE TABLE IF NOT EXISTS digest_item_reviews (
      item_key TEXT PRIMARY KEY,
      rating INTEGER,
      follow_up INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// src/state/reviewRepository.ts
export function saveDigestReviewItems(db: PipelineDb, input: SaveDigestReviewItemsInput): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO digest_review_items (
      digest_date, run_id, item_key, published_at, title, excerpt, item_url,
      source_name, topic_tags_json, match_score, normalized_item_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of input.items) {
    insert.run(
      input.digestDate,
      input.runId,
      item.itemKey,
      item.publishedAt,
      item.title,
      item.excerpt,
      item.itemUrl,
      item.sourceName,
      JSON.stringify(item.topicTags),
      item.matchScore,
      item.normalizedItemJson,
    );
  }
}

export function upsertItemReview(db: PipelineDb, input: { itemKey: string; rating: number | null; followUp: boolean }): void {
  db.prepare(`
    INSERT INTO digest_item_reviews (item_key, rating, follow_up, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_key) DO UPDATE SET
      rating = excluded.rating,
      follow_up = excluded.follow_up,
      updated_at = CURRENT_TIMESTAMP
  `).run(input.itemKey, input.rating, input.followUp ? 1 : 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/reviewRepository.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/state/schema.ts src/state/db.ts src/state/reviewRepository.ts tests/state/reviewRepository.test.ts
git commit -m "feat: add review website persistence schema"
```

---

### Task 2: Persist final digest items as website snapshots from the same selected item set

**Files:**
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `src/insights/analyzeKeyInsights.ts` (only if a stable excerpt field needs reuse/export; otherwise leave untouched)
- Test: `tests/jobs/runDailyDigest.pipeline.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
it('persists website review snapshots from the same final digest item set', async () => {
  process.env.VITEST = '1';
  const result = await runDailyDigest(null, false);
  const db = openPipelineDb(process.env.PIPELINE_DB_PATH!);
  const digestDate = new Date().toISOString().slice(0, 10);

  const reviewItems = listReviewItemsWindow(db, {
    startDigestDate: digestDate,
    endDigestDate: digestDate,
  });

  expect(reviewItems.map((item) => item.itemKey).sort()).toEqual(
    result.items.map((item) => item.id).sort(),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/runDailyDigest.pipeline.test.ts`
Expected: FAIL because `runDailyDigest()` does not yet write digest review snapshots.

- [ ] **Step 3: Write minimal persistence wiring**

```ts
// src/jobs/runDailyDigest.ts
import { saveDigestReviewItems } from '../state/reviewRepository.js';

const digestDate = now.toISOString().slice(0, 10);

saveDigestReviewItems(openPipelineDb(resolvedPipelineDbPath), {
  digestDate,
  runId: pipelineResult.runId,
  items: typedItems.map((item) => ({
    itemKey: item.id,
    publishedAt: item.published_at?.toISOString() ?? null,
    title: item.title,
    excerpt: item.summary ?? item.content_text?.slice(0, 240) ?? '',
    itemUrl: item.item_url,
    sourceName: item.source_name,
    topicTags: item.topic_tags ?? [],
    matchScore: item.relevance_scores?.overall ?? 0,
    normalizedItemJson: JSON.stringify(item),
  })),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/jobs/runDailyDigest.pipeline.test.ts`
Expected: PASS, proving website snapshot item membership matches final digest items.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/runDailyDigest.ts tests/jobs/runDailyDigest.pipeline.test.ts
git commit -m "feat: persist digest snapshots for review website"
```

---

### Task 3: Build review item query/service for rolling 5-day website data

**Files:**
- Create: `src/web/reviewTypes.ts`
- Create: `src/web/reviewService.ts`
- Test: `tests/web/reviewService.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb } from '../../src/state/db.js';
import { initializePipelineSchema } from '../../src/state/schema.js';
import { saveDigestReviewItems, upsertItemReview } from '../../src/state/reviewRepository.js';
import { listReviewFeedItems } from '../../src/web/reviewService.js';

describe('reviewService', () => {
  it('returns only the latest 5-day window sorted by published date ascending with merged review state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-feed-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        { itemKey: 'b', publishedAt: '2026-05-30T12:00:00.000Z', title: 'B', excerpt: 'B', itemUrl: 'https://b', sourceName: 'S', topicTags: ['AI'], matchScore: 0.7, normalizedItemJson: '{}' },
        { itemKey: 'a', publishedAt: '2026-05-29T12:00:00.000Z', title: 'A', excerpt: 'A', itemUrl: 'https://a', sourceName: 'S', topicTags: ['ML'], matchScore: 0.9, normalizedItemJson: '{}' },
      ],
    });
    saveDigestReviewItems(db, {
      digestDate: '2026-05-24',
      runId: 'run-2',
      items: [
        { itemKey: 'old', publishedAt: '2026-05-24T08:00:00.000Z', title: 'Old', excerpt: 'Old', itemUrl: 'https://old', sourceName: 'S', topicTags: ['Old'], matchScore: 0.1, normalizedItemJson: '{}' },
      ],
    });
    upsertItemReview(db, { itemKey: 'a', rating: 5, followUp: true });

    const items = listReviewFeedItems(db, { now: new Date('2026-05-30T13:00:00.000Z'), days: 5 });

    expect(items.map((item) => item.itemKey)).toEqual(['a', 'b']);
    expect(items[0]).toMatchObject({ rating: 5, followUp: true });
    expect(items[1]).toMatchObject({ rating: null, followUp: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/reviewService.test.ts`
Expected: FAIL because website service types/functions do not exist yet.

- [ ] **Step 3: Write minimal query/service code**

```ts
// src/web/reviewTypes.ts
export interface ReviewFeedItem {
  itemKey: string;
  digestDate: string;
  publishedAt: string | null;
  title: string;
  excerpt: string;
  itemUrl: string | null;
  sourceName: string | null;
  topicTags: string[];
  matchScore: number;
  rating: number | null;
  followUp: boolean;
}

// src/web/reviewService.ts
export function listReviewFeedItems(db: PipelineDb, input: { now: Date; days: number }): ReviewFeedItem[] {
  const endDigestDate = input.now.toISOString().slice(0, 10);
  const start = new Date(input.now);
  start.setUTCDate(start.getUTCDate() - (input.days - 1));
  const startDigestDate = start.toISOString().slice(0, 10);

  return listReviewItemsWindow(db, { startDigestDate, endDigestDate })
    .sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/reviewService.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/web/reviewTypes.ts src/web/reviewService.ts tests/web/reviewService.test.ts
git commit -m "feat: add review website feed service"
```

---

### Task 4: Render the review page HTML with feed cards and empty state

**Files:**
- Create: `src/web/renderReviewPage.ts`
- Test: `tests/web/renderReviewPage.test.ts`

- [ ] **Step 1: Write the failing render test**

```ts
import { describe, expect, it } from 'vitest';
import { renderReviewPage } from '../../src/web/renderReviewPage.js';

describe('renderReviewPage', () => {
  it('renders cards with tags, score, rating controls, and follow-up control', () => {
    const html = renderReviewPage({
      items: [
        {
          itemKey: 'item-1',
          digestDate: '2026-05-30',
          publishedAt: '2026-05-30T10:00:00.000Z',
          title: 'Alpha item',
          excerpt: 'Alpha excerpt',
          itemUrl: 'https://example.com/a',
          sourceName: 'Example',
          topicTags: ['AI'],
          matchScore: 0.92,
          rating: 4,
          followUp: true,
        },
      ],
    });

    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('Alpha item');
    expect(html).toContain('AI');
    expect(html).toContain('92% match');
    expect(html).toContain('data-item-key="item-1"');
    expect(html).toContain('Follow-up');
  });

  it('renders an empty state when no review items exist', () => {
    const html = renderReviewPage({ items: [] });
    expect(html).toContain('No digest items available in the last 5 days.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/renderReviewPage.test.ts`
Expected: FAIL because `renderReviewPage()` does not exist.

- [ ] **Step 3: Write minimal renderer implementation**

```ts
export function renderReviewPage(input: { items: ReviewFeedItem[] }): string {
  const cards = input.items.length === 0
    ? '<div class="empty-state">No digest items available in the last 5 days.</div>'
    : input.items.map((item) => `
      <article class="feed-item" data-item-key="${item.itemKey}">
        <div class="item-meta">${item.topicTags.map((tag) => `<span class="topic-badge">${tag}</span>`).join('')}</div>
        <h3 class="item-title">${item.title}</h3>
        <p class="item-excerpt">${item.excerpt}</p>
        <div class="rel-pill">${Math.round(item.matchScore * 100)}% match</div>
        <div class="item-footer">
          <div class="rating" data-rating="${item.rating ?? ''}"></div>
          <label><input type="checkbox" ${item.followUp ? 'checked' : ''}/> Follow-up</label>
        </div>
      </article>
    `).join('');

  return `<!doctype html><html><head><title>AI Pulse Scout Review</title></head><body><div class="app"><div class="feed">${cards}</div></div></body></html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/renderReviewPage.test.ts`
Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/web/renderReviewPage.ts tests/web/renderReviewPage.test.ts
git commit -m "feat: render review website page"
```

---

### Task 5: Add HTTP routes for page render and persisted interactions

**Files:**
- Create: `src/web/reviewServer.ts`
- Create: `src/cli/reviewServer.ts`
- Modify: `package.json`
- Test: `tests/web/reviewServer.test.ts`

- [ ] **Step 1: Write the failing server/API test**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb } from '../../src/state/db.js';
import { initializePipelineSchema } from '../../src/state/schema.js';
import { saveDigestReviewItems } from '../../src/state/reviewRepository.js';
import { createReviewServer } from '../../src/web/reviewServer.js';

describe('reviewServer', () => {
  it('serves review items and persists rating/follow-up updates', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-server-'));
    const dbPath = join(dir, 'pipeline.sqlite');
    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);
    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        { itemKey: 'item-1', publishedAt: '2026-05-30T10:00:00.000Z', title: 'Alpha item', excerpt: 'Alpha excerpt', itemUrl: 'https://example.com/a', sourceName: 'Example', topicTags: ['AI'], matchScore: 0.92, normalizedItemJson: '{}' },
      ],
    });

    const server = createReviewServer({ dbPath, now: () => new Date('2026-05-30T12:00:00.000Z') });

    const listResponse = await server.fetch('/api/review-items');
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      items: [{ itemKey: 'item-1', rating: null, followUp: false }],
    });

    const ratingResponse = await server.fetch('/api/review-items/item-1/rating', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    expect(ratingResponse.status).toBe(200);

    const followUpResponse = await server.fetch('/api/review-items/item-1/follow-up', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ followUp: true }),
    });
    expect(followUpResponse.status).toBe(200);

    const updatedList = await (await server.fetch('/api/review-items')).json();
    expect(updatedList.items[0]).toMatchObject({ rating: 5, followUp: true });
  });

  it('rejects invalid rating values', async () => {
    const server = createReviewServer({ dbPath: ':memory:', now: () => new Date('2026-05-30T12:00:00.000Z') });
    const response = await server.fetch('/api/review-items/missing/rating', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 99 }),
    });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/reviewServer.test.ts`
Expected: FAIL because the review server routes do not exist.

- [ ] **Step 3: Write minimal review server and CLI**

```ts
// src/web/reviewServer.ts
export function createReviewServer(input: { dbPath: string; now?: () => Date }) {
  const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const db = openPipelineDb(input.dbPath);
    initializePipelineSchema(db);

    if (request.method === 'GET' && url.pathname === '/') {
      const items = listReviewFeedItems(db, { now: (input.now ?? (() => new Date()))(), days: 5 });
      return new Response(renderReviewPage({ items }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    if (request.method === 'GET' && url.pathname === '/api/review-items') {
      const items = listReviewFeedItems(db, { now: (input.now ?? (() => new Date()))(), days: 5 });
      return Response.json({ items });
    }

    if (request.method === 'POST' && /^\/api\/review-items\/[^/]+\/rating$/.test(url.pathname)) {
      const itemKey = decodeURIComponent(url.pathname.split('/')[3] ?? '');
      const body = await request.json() as { rating: number | null };
      if (body.rating !== null && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
        return new Response('invalid rating', { status: 400 });
      }
      upsertItemReview(db, { itemKey, rating: body.rating, followUp: getExistingFollowUp(db, itemKey) });
      return Response.json({ ok: true });
    }

    if (request.method === 'POST' && /^\/api\/review-items\/[^/]+\/follow-up$/.test(url.pathname)) {
      const itemKey = decodeURIComponent(url.pathname.split('/')[3] ?? '');
      const body = await request.json() as { followUp: boolean };
      if (typeof body.followUp !== 'boolean') {
        return new Response('invalid followUp', { status: 400 });
      }
      upsertItemReview(db, { itemKey, rating: getExistingRating(db, itemKey), followUp: body.followUp });
      return Response.json({ ok: true });
    }

    return new Response('not found', { status: 404 });
  };

  return {
    fetch: (path: string, init?: RequestInit) => handler(new Request(`http://review.local${path}`, init)),
  };
}

// src/cli/reviewServer.ts
const port = Number(process.env.PORT ?? 3000);
serve(createReviewServer({ dbPath: process.env.PIPELINE_DB_PATH ?? 'data/pipeline.sqlite' }).fetch, { port });
console.log(`AI Pulse Scout review server running at http://localhost:${port}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/reviewServer.test.ts`
Expected: PASS with API validation and persistence behavior covered.

- [ ] **Step 5: Commit**

```bash
git add src/web/reviewServer.ts src/cli/reviewServer.ts package.json tests/web/reviewServer.test.ts
git commit -m "feat: add review website server and api"
```

---

### Task 6: Verify rendered page behavior against real feed expectations

**Files:**
- Modify: `src/web/renderReviewPage.ts`
- Modify: `src/web/reviewServer.ts`
- Test: `tests/web/renderReviewPage.test.ts`
- Test: `tests/web/reviewServer.test.ts`

- [ ] **Step 1: Write the failing behavior test**

```ts
it('renders review items in published date ascending order with persisted values in markup', async () => {
  const response = await server.fetch('/');
  const html = await response.text();

  expect(html.indexOf('Older item')).toBeLessThan(html.indexOf('Newer item'));
  expect(html).toContain('data-rating="5"');
  expect(html).toContain('checked');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/renderReviewPage.test.ts tests/web/reviewServer.test.ts`
Expected: FAIL if rendered markup does not yet reflect persisted state or stable ordering.

- [ ] **Step 3: Write minimal rendering fixes**

```ts
const sortedItems = [...input.items].sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));

const ratingButtons = [1, 2, 3, 4, 5]
  .map((value) => `<button type="button" class="star${value <= (item.rating ?? 0) ? ' filled' : ''}" data-value="${value}">★</button>`)
  .join('');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/renderReviewPage.test.ts tests/web/reviewServer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/renderReviewPage.ts src/web/reviewServer.ts tests/web/renderReviewPage.test.ts tests/web/reviewServer.test.ts
git commit -m "feat: finalize review website interaction rendering"
```

---

### Task 7: Run focused regression and manual startup verification

**Files:**
- Modify: `package.json` (only if command cleanup is needed)
- Test: `tests/state/reviewRepository.test.ts`
- Test: `tests/jobs/runDailyDigest.pipeline.test.ts`
- Test: `tests/web/reviewService.test.ts`
- Test: `tests/web/renderReviewPage.test.ts`
- Test: `tests/web/reviewServer.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run:
```bash
npx vitest run \
  tests/state/reviewRepository.test.ts \
  tests/jobs/runDailyDigest.pipeline.test.ts \
  tests/web/reviewService.test.ts \
  tests/web/renderReviewPage.test.ts \
  tests/web/reviewServer.test.ts
```

Expected: all listed files PASS.

- [ ] **Step 2: Start the review server manually**

Run:
```bash
npm run review:web
```

Expected:
- local server starts successfully
- console prints local URL
- no boot-time schema/runtime error occurs

- [ ] **Step 3: Generate/refresh digest data for manual checking**

Run:
```bash
npm run pipeline:run
```

Expected:
- digest pipeline completes
- website data snapshot is populated
- no divergence error between final digest items and website snapshot path

- [ ] **Step 4: Re-run a targeted regression after manual verification**

Run:
```bash
npx vitest run tests/web/reviewServer.test.ts tests/jobs/runDailyDigest.pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "test: verify review website pipeline integration"
```

---

## Self-Review

### Spec coverage check
- Same final items as scheduled email: covered in Task 2 snapshot persistence test and wiring.
- Single-column website feed: covered in Tasks 4 and 6 page rendering.
- No grouping, topic tags instead: covered in Task 4 markup expectations.
- Date ascending ordering: covered in Tasks 3 and 6.
- Rolling 5-day history: covered in Task 3.
- Persisted star rating and follow-up: covered in Tasks 1 and 5.
- Single-user private internal tool: reflected in the one-record-per-item review schema across Tasks 1 and 5.
- No explicit original-link button in v1: preserved by keeping card rendering minimal in Task 4.

### Placeholder scan
- No `TODO`, `TBD`, or undefined “handle later” steps remain.
- Each task has explicit file paths, commands, expected outcomes, and commit boundaries.

### Type consistency check
- Shared names are consistent across tasks:
  - `saveDigestReviewItems`
  - `upsertItemReview`
  - `listReviewItemsWindow`
  - `listReviewFeedItems`
  - `renderReviewPage`
  - `createReviewServer`
- Persisted review state stays `rating` + `followUp` everywhere.
- Rolling-window logic consistently uses `days: 5` and `publishedAt` ascending ordering.
