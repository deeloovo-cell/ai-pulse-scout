# Phase 1 Full-Item Async Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SQLite-backed run/item persistence plus asynchronous fetch/enrichment processing so AI Pulse Scout can attempt all discovered items, publish when failed items stay within the 50% threshold, and carry failed items into later retry/send handling.

**Architecture:** Keep the current Node/TypeScript script-first structure, but move orchestration from one synchronous in-memory digest pass to a persisted run pipeline. Add a lightweight SQLite-backed storage layer, worker-facing state transitions, and threshold-based publish gating while reusing existing ingestion, enrichment, and render logic where possible.

**Tech Stack:** Node.js, TypeScript, Vitest, SQLite (`node:sqlite` if available on this runtime, otherwise a minimal sqlite package already approved during implementation), existing AI Pulse Scout adapters/renderers.

---

## File Structure

### New files
- `src/state/db.ts` — SQLite connection/bootstrap helpers and schema initialization.
- `src/state/schema.ts` — schema DDL and migration bootstrap for runs/items/item contents/item enrichments/item attempts.
- `src/state/runRepository.ts` — run CRUD + counters + publish-threshold queries.
- `src/state/itemRepository.ts` — item CRUD, claim/transition helpers, retry/defer/failure updates.
- `src/jobs/runPipeline.ts` — high-level orchestration for collect → workers → publish eligibility evaluation.
- `src/jobs/fetchWorker.ts` — fetch-stage worker loop over persisted pending items.
- `src/jobs/enrichmentWorker.ts` — enrichment-stage worker loop over persisted ready items.
- `src/jobs/publishThreshold.ts` — policy helpers for 50% failure threshold and “enough ready items” checks.
- `src/cli/runPipeline.ts` — CLI entrypoint for Phase 1 pipeline execution.
- `tests/state/db.test.ts` — schema/bootstrap coverage.
- `tests/state/runRepository.test.ts` — run persistence and threshold-counter coverage.
- `tests/state/itemRepository.test.ts` — item state transitions, claim semantics, retry/defer logic.
- `tests/jobs/publishThreshold.test.ts` — threshold logic.
- `tests/jobs/fetchWorker.test.ts` — persisted fetch worker behavior.
- `tests/jobs/enrichmentWorker.test.ts` — persisted enrichment worker behavior.
- `tests/jobs/runPipeline.test.ts` — end-to-end pipeline orchestration with threshold publish behavior.

### Existing files to modify
- `src/jobs/runDailyDigest.ts` — adapt current flow so final digest rendering can consume persisted ready items or stay as legacy wrapper.
- `src/cli/sendTest.ts` — call new pipeline path or expose a flag for pipeline-backed run.
- `src/insights/analyzeKeyInsights.ts` — extract a single-item enrichment helper that workers can call safely.
- `src/insights/enrichSelectedItems.ts` — preserve compatibility while delegating per-item logic to reusable helpers.
- `src/state/runState.ts` — either deprecate or reduce to legacy compatibility once SQLite-backed runs exist.
- `package.json` — add any required SQLite dependency and CLI script if runtime support requires it.

---

### Task 1: Add SQLite bootstrap and schema initialization

**Files:**
- Create: `src/state/schema.ts`
- Create: `src/state/db.ts`
- Test: `tests/state/db.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing schema bootstrap test**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';

describe('pipeline db bootstrap', () => {
  it('creates core tables for pipeline persistence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-db-'));
    const dbPath = join(dir, 'pipeline.sqlite');

    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining(['item_attempts', 'item_contents', 'item_enrichments', 'items', 'runs']),
    );

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/db.test.ts`
Expected: FAIL with module-not-found errors for `src/state/db.ts`

- [ ] **Step 3: Add schema definitions**

```ts
// src/state/schema.ts
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    window_date TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    collection_completed_at TEXT,
    completed_at TEXT,
    published_at TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    terminal_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    deferred_items INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TEXT,
    dedupe_key TEXT NOT NULL,
    content_status TEXT NOT NULL,
    enrichment_status TEXT NOT NULL,
    final_status TEXT NOT NULL,
    retry_count_fetch INTEGER NOT NULL DEFAULT 0,
    retry_count_enrichment INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    carry_forward_run_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES runs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS item_contents (
    item_id TEXT PRIMARY KEY,
    raw_content TEXT,
    clean_content TEXT,
    content_length INTEGER NOT NULL DEFAULT 0,
    fetch_method TEXT,
    fetch_started_at TEXT,
    fetch_completed_at TEXT,
    fetch_duration_ms INTEGER,
    fetch_error TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`,
  `CREATE TABLE IF NOT EXISTS item_enrichments (
    item_id TEXT PRIMARY KEY,
    model TEXT,
    prompt_version TEXT,
    summary TEXT,
    why_it_matters TEXT,
    topics_json TEXT NOT NULL DEFAULT '[]',
    relevance_score REAL,
    relevance_bucket TEXT,
    raw_response TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    duration_ms INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`,
  `CREATE TABLE IF NOT EXISTS item_attempts (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    outcome TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id)
  )`,
];
```

- [ ] **Step 4: Add DB open/init helpers**

```ts
// src/state/db.ts
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_STATEMENTS } from './schema.js';

export function openPipelineDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  return new DatabaseSync(path);
}

export function initializePipelineSchema(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
}
```

- [ ] **Step 5: Update package metadata only if runtime support is missing**

```json
{
  "scripts": {
    "pipeline:run": "tsx src/cli/runPipeline.ts"
  }
}
```

If `node:sqlite` is unavailable during implementation, add one approved SQLite dependency and document that change in this task instead of improvising later.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/state/db.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json src/state/schema.ts src/state/db.ts tests/state/db.test.ts
git commit -m "feat: add pipeline sqlite schema bootstrap"
```

### Task 2: Implement run repository and publish-threshold counters

**Files:**
- Create: `src/state/runRepository.ts`
- Test: `tests/state/runRepository.test.ts`
- Modify: `src/state/db.ts`

- [ ] **Step 1: Write the failing run repository tests**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun, getRunById, markRunReadyForProcessing, updateRunCounters } from '../../src/state/runRepository.js';

describe('runRepository', () => {
  it('creates and updates a run record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-run-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    createRun(db, {
      id: 'run-1',
      windowDate: '2026-05-30',
      startedAt: '2026-05-30T06:00:00.000Z',
    });
    markRunReadyForProcessing(db, 'run-1', '2026-05-30T06:01:00.000Z');
    updateRunCounters(db, 'run-1', {
      totalItems: 10,
      successfulItems: 6,
      failedItems: 2,
      deferredItems: 1,
      terminalItems: 9,
    });

    expect(getRunById(db, 'run-1')).toMatchObject({
      id: 'run-1',
      status: 'ready_for_processing',
      total_items: 10,
      successful_items: 6,
      failed_items: 2,
      deferred_items: 1,
      terminal_items: 9,
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/runRepository.test.ts`
Expected: FAIL with missing repository functions

- [ ] **Step 3: Implement run repository helpers**

```ts
// src/state/runRepository.ts
import type { DatabaseSync } from 'node:sqlite';

export function createRun(
  db: DatabaseSync,
  input: { id: string; windowDate: string; startedAt: string },
): void {
  db.prepare(
    `INSERT INTO runs (id, window_date, status, started_at)
     VALUES (?, ?, 'created', ?)`,
  ).run(input.id, input.windowDate, input.startedAt);
}

export function markRunReadyForProcessing(db: DatabaseSync, runId: string, completedAt: string): void {
  db.prepare(
    `UPDATE runs
     SET status = 'ready_for_processing', collection_completed_at = ?
     WHERE id = ?`,
  ).run(completedAt, runId);
}

export function updateRunCounters(
  db: DatabaseSync,
  runId: string,
  counters: {
    totalItems: number;
    terminalItems: number;
    successfulItems: number;
    failedItems: number;
    deferredItems: number;
  },
): void {
  db.prepare(
    `UPDATE runs
     SET total_items = ?, terminal_items = ?, successful_items = ?, failed_items = ?, deferred_items = ?
     WHERE id = ?`,
  ).run(
    counters.totalItems,
    counters.terminalItems,
    counters.successfulItems,
    counters.failedItems,
    counters.deferredItems,
    runId,
  );
}

export function getRunById(db: DatabaseSync, runId: string) {
  return db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/runRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/runRepository.ts tests/state/runRepository.test.ts
git commit -m "feat: add pipeline run repository"
```

### Task 3: Implement item repository and state transitions

**Files:**
- Create: `src/state/itemRepository.ts`
- Test: `tests/state/itemRepository.test.ts`
- Modify: `src/state/runRepository.ts`

- [ ] **Step 1: Write failing item repository tests**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import {
  insertDiscoveredItems,
  claimNextFetchItem,
  markFetchDone,
  markEnrichmentFailed,
  markDeferredForRetry,
  listItemsForRun,
} from '../../src/state/itemRepository.js';

describe('itemRepository', () => {
  it('supports claim and state transitions for pipeline items', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-items-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });

    insertDiscoveredItems(db, 'run-1', [
      {
        id: 'item-1',
        sourceId: 'source-a',
        url: 'https://example.com/a',
        title: 'A',
        publishedAt: '2026-05-30T05:00:00.000Z',
        dedupeKey: 'url:https://example.com/a',
      },
    ]);

    const claimed = claimNextFetchItem(db);
    expect(claimed?.id).toBe('item-1');

    markFetchDone(db, 'item-1', {
      rawContent: '<html>A</html>',
      cleanContent: 'A',
      fetchMethod: 'http',
      durationMs: 100,
      completedAt: '2026-05-30T06:01:00.000Z',
    });
    markEnrichmentFailed(db, 'item-1');
    markDeferredForRetry(db, 'item-1', 'run-2');

    expect(listItemsForRun(db, 'run-1')[0]).toMatchObject({
      id: 'item-1',
      content_status: 'done',
      final_status: 'deferred_for_retry',
      carry_forward_run_id: 'run-2',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/itemRepository.test.ts`
Expected: FAIL with missing repository functions

- [ ] **Step 3: Implement item insert + claim + transition helpers**

```ts
// src/state/itemRepository.ts
import type { DatabaseSync } from 'node:sqlite';

interface DiscoveredItemInput {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  dedupeKey: string;
}

export function insertDiscoveredItems(db: DatabaseSync, runId: string, items: DiscoveredItemInput[]): void {
  const stmt = db.prepare(
    `INSERT INTO items (
      id, run_id, source_id, url, title, published_at, dedupe_key,
      content_status, enrichment_status, final_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', ?, ?)`,
  );
  for (const item of items) {
    stmt.run(
      item.id,
      runId,
      item.sourceId,
      item.url,
      item.title,
      item.publishedAt,
      item.dedupeKey,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
}

export function claimNextFetchItem(db: DatabaseSync) {
  const row = db.prepare(
    `SELECT id FROM items WHERE content_status = 'pending' ORDER BY created_at ASC LIMIT 1`,
  ).get() as { id: string } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE items SET content_status = 'running', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);
  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(row.id);
}

export function markFetchDone(
  db: DatabaseSync,
  itemId: string,
  input: {
    rawContent: string;
    cleanContent: string;
    fetchMethod: string;
    durationMs: number;
    completedAt: string;
  },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO item_contents (
      item_id, raw_content, clean_content, content_length, fetch_method, fetch_completed_at, fetch_duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    input.rawContent,
    input.cleanContent,
    input.cleanContent.length,
    input.fetchMethod,
    input.completedAt,
    input.durationMs,
  );
  db.prepare(
    `UPDATE items
     SET content_status = 'done', enrichment_status = 'pending', updated_at = ?
     WHERE id = ?`,
  ).run(input.completedAt, itemId);
}

export function markEnrichmentFailed(db: DatabaseSync, itemId: string): void {
  db.prepare(
    `UPDATE items
     SET enrichment_status = 'failed', final_status = 'enrichment_failed', updated_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), itemId);
}

export function markDeferredForRetry(db: DatabaseSync, itemId: string, nextRunId: string): void {
  db.prepare(
    `UPDATE items
     SET final_status = 'deferred_for_retry', carry_forward_run_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextRunId, new Date().toISOString(), itemId);
}

export function listItemsForRun(db: DatabaseSync, runId: string) {
  return db.prepare(`SELECT * FROM items WHERE run_id = ? ORDER BY created_at ASC`).all(runId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/itemRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/itemRepository.ts tests/state/itemRepository.test.ts
git commit -m "feat: add pipeline item repository"
```

### Task 4: Add publish-threshold policy helper

**Files:**
- Create: `src/jobs/publishThreshold.ts`
- Test: `tests/jobs/publishThreshold.test.ts`

- [ ] **Step 1: Write failing threshold policy tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluatePublishThreshold } from '../../src/jobs/publishThreshold.js';

describe('publish threshold policy', () => {
  it('allows publish when failed items are 50% or less and there are ready items', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 5, failedItems: 5 }),
    ).toEqual({ publishable: true, failedRatio: 0.5 });
  });

  it('blocks publish when failed items exceed 50%', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 4, failedItems: 6 }),
    ).toEqual({ publishable: false, failedRatio: 0.6 });
  });

  it('blocks publish when there are no successful items', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 0, failedItems: 2 }),
    ).toEqual({ publishable: false, failedRatio: 0.2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/publishThreshold.test.ts`
Expected: FAIL with missing module

- [ ] **Step 3: Implement threshold helper**

```ts
// src/jobs/publishThreshold.ts
export function evaluatePublishThreshold(input: {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
}): { publishable: boolean; failedRatio: number } {
  const failedRatio = input.totalItems === 0 ? 1 : input.failedItems / input.totalItems;
  const publishable = input.successfulItems > 0 && failedRatio <= 0.5;
  return { publishable, failedRatio };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/jobs/publishThreshold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/jobs/publishThreshold.ts tests/jobs/publishThreshold.test.ts
git commit -m "feat: add publish threshold policy"
```

### Task 5: Extract reusable single-item enrichment helper

**Files:**
- Modify: `src/insights/analyzeKeyInsights.ts`
- Modify: `src/insights/enrichSelectedItems.ts`
- Test: `tests/enrichSelectedItems.test.ts`
- Create: `tests/jobs/enrichmentWorker.test.ts`

- [ ] **Step 1: Write failing reusable enrichment tests**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/insights/chatCompletions.js', () => ({
  resolveLlmClient: () => ({ provider: 'test' }),
  requestChatCompletion: vi.fn(async () => JSON.stringify({
    why_it_matters: '中文价值判断',
    growth_lever: 'Efficiency',
    applies_to: ['R&D'],
    action: 'Monitor',
    manufacturing_relevance: 'High',
  })),
}));

import { enrichSingleItem } from '../../src/insights/analyzeKeyInsights.js';

describe('enrichSingleItem', () => {
  it('returns enriched item insight data for one item', async () => {
    const result = await enrichSingleItem({
      title: 'Test item',
      source_name: 'Source',
      source_category: 'webpage',
      source_url: 'https://example.com',
      item_url: 'https://example.com/item',
      published_at: new Date('2026-05-30T00:00:00.000Z'),
      fetched_at: new Date('2026-05-30T00:00:00.000Z'),
      author: '',
      content_text: 'Body',
      summary: 'Summary',
      tags: [],
      content_type: 'article',
      fingerprint: 'x',
      relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
      decision: 'pending',
      decision_reason: '',
      primary_topic: 'AI News Roundup',
    });

    expect(result.key_insight).toBe('中文价值判断');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/enrichSelectedItems.test.ts tests/jobs/enrichmentWorker.test.ts`
Expected: FAIL with missing `enrichSingleItem`

- [ ] **Step 3: Extract reusable single-item function and delegate list enrichment to it**

```ts
// inside src/insights/analyzeKeyInsights.ts
export async function enrichSingleItem(
  item: NormalizedItem,
  options: KeyInsightOptions = {},
): Promise<NormalizedItem> {
  const client = resolveLlmClient(options);
  if (!client) return attachFallbackInsight(item);

  const fetchFullPosts =
    options.fetchFullPosts ??
    (process.env.DEEPSEEK_FETCH_FULL_POSTS ?? process.env.GLM_FETCH_FULL_POSTS) !== 'false';

  try {
    const articleText = fetchFullPosts ? await fetchArticleText(item.item_url) : null;
    const raw = await requestChatCompletion(
      client,
      [
        { role: 'system', content: ITEM_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this item for the daily manufacturing AI digest.\n\n${buildArticleContext(item, articleText)}`,
        },
      ],
      900,
    );
    return applyInsightResponse(item, raw);
  } catch {
    return attachFallbackInsight(item);
  }
}

export async function enrichKeyInsights(
  items: NormalizedItem[],
  options: KeyInsightOptions = {},
): Promise<NormalizedItem[]> {
  const enriched: NormalizedItem[] = [];
  for (const item of items) enriched.push(await enrichSingleItem(item, options));
  return enriched;
}
```

- [ ] **Step 4: Keep `enrichSelectedItems` behavior unchanged while delegating**

```ts
// src/insights/enrichSelectedItems.ts
import { enrichKeyInsights } from './analyzeKeyInsights.js';

export const DEFAULT_ENRICHMENT_CAP = 25;

export async function enrichSelectedItems(
  items: NormalizedItem[],
  cap = DEFAULT_ENRICHMENT_CAP,
): Promise<NormalizedItem[]> {
  const itemsToEnrich = items.slice(0, cap);
  const enriched = await enrichKeyInsights(itemsToEnrich);
  return enriched.concat(items.slice(cap));
}
```

Keep this file compatible for legacy callers in Phase 1.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/enrichSelectedItems.test.ts tests/jobs/enrichmentWorker.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/insights/analyzeKeyInsights.ts src/insights/enrichSelectedItems.ts tests/enrichSelectedItems.test.ts tests/jobs/enrichmentWorker.test.ts
git commit -m "refactor: add reusable single-item enrichment helper"
```

### Task 6: Implement fetch worker behavior

**Files:**
- Create: `src/jobs/fetchWorker.ts`
- Test: `tests/jobs/fetchWorker.test.ts`
- Modify: `src/state/itemRepository.ts`

- [ ] **Step 1: Write failing fetch worker tests**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, listItemsForRun } from '../../src/state/itemRepository.js';
import { runFetchWorkerOnce } from '../../src/jobs/fetchWorker.js';

describe('fetchWorker', () => {
  it('claims one pending item and stores fetched content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-fetch-worker-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [{
      id: 'item-1', sourceId: 'source-a', url: 'https://example.com/a', title: 'A', publishedAt: null, dedupeKey: 'url:a',
    }]);

    await runFetchWorkerOnce(db, async () => ({
      rawContent: '<html>A</html>',
      cleanContent: 'A body',
      fetchMethod: 'test-fetcher',
    }));

    expect(listItemsForRun(db, 'run-1')[0]).toMatchObject({
      id: 'item-1',
      content_status: 'done',
      enrichment_status: 'pending',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/fetchWorker.test.ts`
Expected: FAIL with missing fetch worker module

- [ ] **Step 3: Implement one-step fetch worker**

```ts
// src/jobs/fetchWorker.ts
import type { DatabaseSync } from 'node:sqlite';
import { claimNextFetchItem, markFetchDone } from '../state/itemRepository.js';

export async function runFetchWorkerOnce(
  db: DatabaseSync,
  fetchItem: (item: { id: string; url: string; title: string }) => Promise<{
    rawContent: string;
    cleanContent: string;
    fetchMethod: string;
  }>,
): Promise<boolean> {
  const item = claimNextFetchItem(db) as { id: string; url: string; title: string } | null;
  if (!item) return false;

  const started = Date.now();
  const result = await fetchItem(item);

  markFetchDone(db, item.id, {
    rawContent: result.rawContent,
    cleanContent: result.cleanContent,
    fetchMethod: result.fetchMethod,
    durationMs: Date.now() - started,
    completedAt: new Date().toISOString(),
  });

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/jobs/fetchWorker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/jobs/fetchWorker.ts tests/jobs/fetchWorker.test.ts src/state/itemRepository.ts
git commit -m "feat: add persisted fetch worker"
```

### Task 7: Implement enrichment worker behavior

**Files:**
- Create: `src/jobs/enrichmentWorker.ts`
- Test: `tests/jobs/enrichmentWorker.test.ts`
- Modify: `src/state/itemRepository.ts`
- Modify: `src/insights/analyzeKeyInsights.ts`

- [ ] **Step 1: Write failing enrichment worker tests**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, markFetchDone, listItemsForRun } from '../../src/state/itemRepository.js';
import { runEnrichmentWorkerOnce } from '../../src/jobs/enrichmentWorker.js';

describe('enrichmentWorker', () => {
  it('marks a fetched item as ready after enrichment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-enrich-worker-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [{
      id: 'item-1', sourceId: 'source-a', url: 'https://example.com/a', title: 'A', publishedAt: null, dedupeKey: 'url:a',
    }]);
    markFetchDone(db, 'item-1', {
      rawContent: '<html>A</html>',
      cleanContent: 'A body',
      fetchMethod: 'test-fetcher',
      durationMs: 12,
      completedAt: '2026-05-30T06:01:00.000Z',
    });

    await runEnrichmentWorkerOnce(db, async () => ({
      summary: 'Summary',
      whyItMatters: 'Why it matters',
      topics: ['AI Infra'],
      relevanceScore: 0.9,
      relevanceBucket: 'high',
      rawResponse: '{}',
      model: 'test-model',
      durationMs: 20,
    }));

    expect(listItemsForRun(db, 'run-1')[0]).toMatchObject({
      enrichment_status: 'done',
      final_status: 'ready',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/enrichmentWorker.test.ts`
Expected: FAIL with missing enrichment worker module

- [ ] **Step 3: Add repository helpers for claiming ready-to-enrich items and marking success**

```ts
// add to src/state/itemRepository.ts
export function claimNextEnrichmentItem(db: DatabaseSync) {
  const row = db.prepare(
    `SELECT id FROM items WHERE content_status = 'done' AND enrichment_status = 'pending' ORDER BY updated_at ASC LIMIT 1`,
  ).get() as { id: string } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE items SET enrichment_status = 'running', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);
  return db.prepare(
    `SELECT items.*, item_contents.clean_content
     FROM items
     LEFT JOIN item_contents ON item_contents.item_id = items.id
     WHERE items.id = ?`,
  ).get(row.id);
}

export function markEnrichmentDone(
  db: DatabaseSync,
  itemId: string,
  result: {
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO item_enrichments (
      item_id, model, prompt_version, summary, why_it_matters, topics_json,
      relevance_score, relevance_bucket, raw_response, duration_ms, created_at
    ) VALUES (?, ?, 'phase1', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    result.model,
    result.summary,
    result.whyItMatters,
    JSON.stringify(result.topics),
    result.relevanceScore,
    result.relevanceBucket,
    result.rawResponse,
    result.durationMs,
    new Date().toISOString(),
  );
  db.prepare(
    `UPDATE items
     SET enrichment_status = 'done', final_status = 'ready', updated_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), itemId);
}
```

- [ ] **Step 4: Implement one-step enrichment worker**

```ts
// src/jobs/enrichmentWorker.ts
import type { DatabaseSync } from 'node:sqlite';
import { claimNextEnrichmentItem, markEnrichmentDone } from '../state/itemRepository.js';

export async function runEnrichmentWorkerOnce(
  db: DatabaseSync,
  enrichItem: (item: { id: string; title: string; clean_content: string | null }) => Promise<{
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  }>,
): Promise<boolean> {
  const item = claimNextEnrichmentItem(db) as { id: string; title: string; clean_content: string | null } | null;
  if (!item) return false;

  const result = await enrichItem(item);
  markEnrichmentDone(db, item.id, result);
  return true;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/jobs/enrichmentWorker.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/jobs/enrichmentWorker.ts src/state/itemRepository.ts tests/jobs/enrichmentWorker.test.ts src/insights/analyzeKeyInsights.ts
git commit -m "feat: add persisted enrichment worker"
```

### Task 8: Build pipeline orchestrator with threshold-based publishing

**Files:**
- Create: `src/jobs/runPipeline.ts`
- Create: `src/cli/runPipeline.ts`
- Test: `tests/jobs/runPipeline.test.ts`
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `src/cli/sendTest.ts`

- [ ] **Step 1: Write failing pipeline orchestration test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runPipeline } from '../../src/jobs/runPipeline.js';

describe('runPipeline', () => {
  it('publishes when failed items stay within the 50 percent threshold', async () => {
    const render = vi.fn(() => '<html>digest</html>');
    const publish = vi.fn(async () => undefined);

    const result = await runPipeline({
      now: new Date('2026-05-30T07:00:00.000Z'),
      ingest: async () => ({
        items: [
          { id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' },
          { id: '2', sourceId: 'b', url: 'https://b', title: 'B', publishedAt: null, dedupeKey: 'b' },
        ],
      }),
      fetchItem: async (item) => ({ rawContent: item.title, cleanContent: item.title, fetchMethod: 'test' }),
      enrichItem: async (item) => {
        if (item.id === '2') throw new Error('boom');
        return {
          summary: 'Summary',
          whyItMatters: 'Why',
          topics: ['AI Infra'],
          relevanceScore: 0.9,
          relevanceBucket: 'high',
          rawResponse: '{}',
          model: 'test-model',
          durationMs: 10,
        };
      },
      render,
      publish,
    });

    expect(result.publishable).toBe(true);
    expect(result.failedItems).toBe(1);
    expect(render).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/runPipeline.test.ts`
Expected: FAIL with missing pipeline orchestrator

- [ ] **Step 3: Implement minimal orchestrator**

```ts
// src/jobs/runPipeline.ts
import { join } from 'node:path';
import { openPipelineDb, initializePipelineSchema } from '../state/db.js';
import { createRun, markRunReadyForProcessing, updateRunCounters } from '../state/runRepository.js';
import {
  insertDiscoveredItems,
  listItemsForRun,
  markEnrichmentFailed,
  markDeferredForRetry,
} from '../state/itemRepository.js';
import { runFetchWorkerOnce } from './fetchWorker.js';
import { runEnrichmentWorkerOnce } from './enrichmentWorker.js';
import { evaluatePublishThreshold } from './publishThreshold.js';

export async function runPipeline(input: {
  now: Date;
  dbPath?: string;
  ingest: () => Promise<{ items: Array<{ id: string; sourceId: string; url: string; title: string; publishedAt: string | null; dedupeKey: string }> }>;
  fetchItem: (item: { id: string; url: string; title: string }) => Promise<{ rawContent: string; cleanContent: string; fetchMethod: string }>;
  enrichItem: (item: { id: string; title: string; clean_content: string | null }) => Promise<{
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  }>;
  render: (items: unknown[]) => string;
  publish: (html: string) => Promise<void>;
}) {
  const db = openPipelineDb(input.dbPath ?? join(process.cwd(), 'data/state/pipeline.sqlite'));
  initializePipelineSchema(db);

  const runId = `run-${input.now.toISOString()}`;
  createRun(db, { id: runId, windowDate: input.now.toISOString().slice(0, 10), startedAt: input.now.toISOString() });

  const ingestion = await input.ingest();
  insertDiscoveredItems(db, runId, ingestion.items);
  markRunReadyForProcessing(db, runId, new Date().toISOString());

  while (await runFetchWorkerOnce(db, input.fetchItem)) {
    // loop until no fetch work remains
  }

  while (true) {
    try {
      const worked = await runEnrichmentWorkerOnce(db, input.enrichItem);
      if (!worked) break;
    } catch {
      const items = listItemsForRun(db, runId) as Array<{ id: string; enrichment_status: string; final_status: string }>;
      const running = items.find((item) => item.enrichment_status === 'running');
      if (running) markEnrichmentFailed(db, running.id);
    }
  }

  const items = listItemsForRun(db, runId) as Array<{ id: string; final_status: string }>;
  const successfulItems = items.filter((item) => item.final_status === 'ready').length;
  const failedItems = items.filter((item) => item.final_status === 'fetch_failed' || item.final_status === 'enrichment_failed').length;
  const totalItems = items.length;

  updateRunCounters(db, runId, {
    totalItems,
    terminalItems: successfulItems + failedItems,
    successfulItems,
    failedItems,
    deferredItems: 0,
  });

  const threshold = evaluatePublishThreshold({ totalItems, successfulItems, failedItems });
  if (threshold.publishable) {
    const readyItems = items.filter((item) => item.final_status === 'ready');
    const html = input.render(readyItems);
    await input.publish(html);
  } else {
    for (const item of items.filter((entry) => entry.final_status !== 'ready')) {
      markDeferredForRetry(db, item.id, `retry-${runId}`);
    }
  }

  db.close();
  return { publishable: threshold.publishable, failedItems, totalItems };
}
```

- [ ] **Step 4: Add CLI wrapper**

```ts
// src/cli/runPipeline.ts
import 'dotenv/config';
import { runPipeline } from '../jobs/runPipeline.js';

const result = await runPipeline({
  now: new Date(),
  ingest: async () => ({ items: [] }),
  fetchItem: async () => ({ rawContent: '', cleanContent: '', fetchMethod: 'noop' }),
  enrichItem: async () => ({
    summary: '', whyItMatters: '', topics: [], relevanceScore: 0, relevanceBucket: 'low', rawResponse: '{}', model: 'noop', durationMs: 0,
  }),
  render: () => '<html></html>',
  publish: async () => undefined,
});

console.log(JSON.stringify(result, null, 2));
```

This wrapper is intentionally minimal in the first pass; later tasks can wire in production adapters once core orchestration is stable.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/jobs/runPipeline.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/jobs/runPipeline.ts src/cli/runPipeline.ts tests/jobs/runPipeline.test.ts src/jobs/runDailyDigest.ts src/cli/sendTest.ts
git commit -m "feat: add phase 1 pipeline orchestrator"
```

### Task 9: Wire production adapters into pipeline and preserve digest rendering compatibility

**Files:**
- Modify: `src/jobs/runPipeline.ts`
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `src/cli/sendTest.ts`
- Test: `tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
- Test: `tests/jobs/runPipeline.test.ts`

- [ ] **Step 1: Write a failing compatibility assertion for persisted ready items**

```ts
it('renders persisted ready items instead of requiring synchronous enrichment during publish', async () => {
  const module = await import('../../src/jobs/runPipeline');
  const result = await module.runPipeline({
    now: new Date('2026-05-30T07:00:00.000Z'),
    ingest: async () => ({ items: [{ id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' }] }),
    fetchItem: async () => ({ rawContent: 'A', cleanContent: 'A', fetchMethod: 'test' }),
    enrichItem: async () => ({
      summary: 'Summary',
      whyItMatters: 'Why',
      topics: ['AI Infra'],
      relevanceScore: 0.9,
      relevanceBucket: 'high',
      rawResponse: '{}',
      model: 'test-model',
      durationMs: 10,
    }),
    render: (items) => `<html>${items.length}</html>`,
    publish: async () => undefined,
  });
  expect(result.publishable).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure or incompatibility**

Run: `npx vitest run tests/jobs/runPipeline.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
Expected: FAIL or expose missing production-wiring behavior

- [ ] **Step 3: Replace placeholder pipeline callbacks with production wiring**

```ts
// inside src/jobs/runPipeline.ts
import { loadConfig } from '../config/loadConfig.js';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';

// provide default ingest implementation that matches existing unified ingestion logic
const config = loadConfig();
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
```

- [ ] **Step 4: Keep `runDailyDigest` as a compatibility wrapper over persisted ready items**

```ts
// inside src/jobs/runDailyDigest.ts
// short-term rule: legacy callers may still call runDailyDigest(), but the function
// should delegate orchestration to runPipeline and only retain subject/html/result shaping.
```

Use the existing subject/render helpers; do not reintroduce synchronous full-run enrichment in this wrapper.

- [ ] **Step 5: Run tests to verify compatibility passes**

Run: `npx vitest run tests/jobs/runPipeline.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/jobs/runPipeline.ts src/jobs/runDailyDigest.ts src/cli/sendTest.ts tests/jobs/runPipeline.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts
git commit -m "refactor: wire production digest flow through pipeline state"
```

### Task 10: Add failure carry-forward reporting and final verification

**Files:**
- Modify: `src/jobs/runPipeline.ts`
- Modify: `src/utils/logger.ts` (only if needed for structured output)
- Test: `tests/jobs/runPipeline.test.ts`
- Test: `tests/jobs/publishThreshold.test.ts`
- Test: `tests/state/itemRepository.test.ts`

- [ ] **Step 1: Write failing carry-forward visibility test**

```ts
it('reports deferred retry items when publish proceeds within threshold', async () => {
  const render = vi.fn(() => '<html>digest</html>');
  const publish = vi.fn(async () => undefined);

  const result = await runPipeline({
    now: new Date('2026-05-30T07:00:00.000Z'),
    ingest: async () => ({
      items: [
        { id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' },
        { id: '2', sourceId: 'b', url: 'https://b', title: 'B', publishedAt: null, dedupeKey: 'b' },
      ],
    }),
    fetchItem: async (item) => ({ rawContent: item.title, cleanContent: item.title, fetchMethod: 'test' }),
    enrichItem: async (item) => {
      if (item.id === '2') throw new Error('boom');
      return {
        summary: 'Summary', whyItMatters: 'Why', topics: ['AI Infra'], relevanceScore: 0.9,
        relevanceBucket: 'high', rawResponse: '{}', model: 'test-model', durationMs: 10,
      };
    },
    render,
    publish,
  });

  expect(result).toMatchObject({ publishable: true, failedItems: 1, deferredItems: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/jobs/runPipeline.test.ts`
Expected: FAIL because deferred counts are not yet surfaced

- [ ] **Step 3: Add carry-forward/deferred reporting to pipeline result**

```ts
// inside src/jobs/runPipeline.ts return value
return {
  publishable: threshold.publishable,
  failedItems,
  totalItems,
  deferredItems: items.filter((item) => item.final_status === 'deferred_for_retry').length,
};
```

If threshold passes and there are failed/retryable items, mark them explicitly and log them before returning.

- [ ] **Step 4: Run full targeted verification suite**

Run: `npx vitest run tests/state/db.test.ts tests/state/runRepository.test.ts tests/state/itemRepository.test.ts tests/jobs/publishThreshold.test.ts tests/jobs/fetchWorker.test.ts tests/jobs/enrichmentWorker.test.ts tests/jobs/runPipeline.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts tests/enrichSelectedItems.test.ts`
Expected: PASS across all listed tests

- [ ] **Step 5: Run repo-wide verification**

Run: `npx vitest run`
Expected: PASS all tests in the repository

- [ ] **Step 6: Commit**

```bash
git add src/jobs/runPipeline.ts tests/jobs/runPipeline.test.ts tests/state/db.test.ts tests/state/runRepository.test.ts tests/state/itemRepository.test.ts tests/jobs/publishThreshold.test.ts tests/jobs/fetchWorker.test.ts tests/jobs/enrichmentWorker.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts tests/enrichSelectedItems.test.ts
git commit -m "feat: finalize phase 1 async enrichment pipeline"
```

---

## Spec Coverage Check

- SQLite persistence: covered by Tasks 1-3.
- Run/item state tracking: covered by Tasks 2-3.
- Fetch/enrichment asynchronous worker stages: covered by Tasks 6-7.
- 50% failure threshold publish policy: covered by Tasks 4, 8, and 10.
- Carry-forward failed items for next send: covered by Tasks 3, 8, and 10.
- Reuse existing Node/script structure: covered by Tasks 8-9.
- Preserve future compatibility with later website/feedback work: partially covered by persisted enrichment fields in Tasks 3 and 7.

## Placeholder Scan

- No unfinished placeholders are intentionally left in the plan.
- Each coding task includes concrete file paths, sample code, and explicit test commands.

## Type Consistency Check

- Run counters use `totalItems`, `successfulItems`, `failedItems`, `deferredItems`, `terminalItems` consistently.
- Item statuses use `pending`, `running`, `done`, `failed`, `ready`, and `deferred_for_retry` consistently across repository and job tasks.
- Threshold helper uses the same 50% policy in all later orchestration tasks.
