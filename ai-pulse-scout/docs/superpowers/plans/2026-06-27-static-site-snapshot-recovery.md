# Static Site Snapshot Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recoverable static-site export flow that saves selected items to a JSON snapshot and can regenerate the final HTML page from that snapshot without re-running ingestion.

**Architecture:** Keep the current `site:export` path intact, but add a narrow persistence boundary after `prepareDigestItems(...).selected`. Normal export writes a selected-items snapshot; a separate recovery CLI reads that snapshot, runs the remaining enrichment/gate/render steps, and writes `data/output/site/index.html`.

**Tech Stack:** TypeScript, tsx CLI entrypoints, existing static export renderer, Vitest.

---

## File map

- Create: `src/static/selectedSnapshot.ts` — resolve default snapshot paths and read/write selected item snapshots.
- Create: `src/cli/renderStaticSiteFromSnapshot.ts` — recovery CLI that renders from a snapshot file.
- Modify: `src/cli/exportStaticSite.ts` — write selected snapshot during normal static export.
- Modify: `package.json` — add a script for recovery rendering.
- Create: `tests/static/selectedSnapshot.test.ts` — snapshot path/read/write coverage.
- Create: `tests/cli/renderStaticSiteFromSnapshot.test.ts` — recovery CLI render coverage.

### Task 1: Add snapshot utility module

**Files:**
- Create: `src/static/selectedSnapshot.ts`
- Test: `tests/static/selectedSnapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultSelectedSnapshotPath,
  readSelectedSnapshot,
  writeSelectedSnapshot,
} from '../../src/static/selectedSnapshot.js';

describe('selectedSnapshot', () => {
  it('resolves the default selected snapshot path for a digest date', () => {
    expect(defaultSelectedSnapshotPath('/repo/data/output/site', '2026-06-27')).toBe(
      '/repo/data/output/site/selected-2026-06-27.json',
    );
  });

  it('writes and reads selected items as json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'selected-snapshot-'));
    const snapshotPath = join(dir, 'selected-2026-06-27.json');
    const items = [
      {
        id: '1',
        source_name: 'Example',
        source_category: 'blog',
        source_url: 'https://example.com/feed.xml',
        item_url: 'https://example.com/post-1',
        title: 'Post 1',
        published_at: null,
        fetched_at: new Date('2026-06-27T00:00:00.000Z'),
        author: '',
        content_text: 'Hello',
        content_html: undefined,
        summary: 'Hello',
        tags: [],
        content_type: 'article',
        fingerprint: 'fp-1',
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
        primary_topic: 'AI Developer Tools & Agents',
      },
    ];

    await writeSelectedSnapshot(snapshotPath, items);
    const loaded = await readSelectedSnapshot(snapshotPath);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.title).toBe('Post 1');
    expect(loaded[0]?.fetched_at).toBeInstanceOf(Date);

    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/static/selectedSnapshot.test.ts
```

Expected: FAIL because `src/static/selectedSnapshot.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { NormalizedItem } from '../types/item.js';

export function defaultSelectedSnapshotPath(outputDir: string, digestDate: string): string {
  return join(outputDir, `selected-${digestDate}.json`);
}

export async function writeSelectedSnapshot(path: string, items: NormalizedItem[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(items, null, 2), 'utf8');
}

export async function readSelectedSnapshot(path: string): Promise<NormalizedItem[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed.map(reviveNormalizedItem);
}

function reviveNormalizedItem(raw: Record<string, unknown>): NormalizedItem {
  return {
    ...(raw as unknown as NormalizedItem),
    published_at: typeof raw.published_at === 'string' ? new Date(raw.published_at) : null,
    fetched_at: new Date(String(raw.fetched_at)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/static/selectedSnapshot.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/static/selectedSnapshot.ts tests/static/selectedSnapshot.test.ts
git commit -m "feat: add selected snapshot utilities"
```

### Task 2: Save selected snapshot during normal static export

**Files:**
- Modify: `src/cli/exportStaticSite.ts`
- Test: `tests/static/selectedSnapshot.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `tests/static/selectedSnapshot.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';

it('writes selected items to the default snapshot path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'selected-snapshot-default-'));
  const snapshotPath = defaultSelectedSnapshotPath(dir, '2026-06-27');
  const items = [
    {
      id: '1',
      source_name: 'Example',
      source_category: 'blog',
      source_url: 'https://example.com/feed.xml',
      item_url: 'https://example.com/post-1',
      title: 'Post 1',
      published_at: null,
      fetched_at: new Date('2026-06-27T00:00:00.000Z'),
      author: '',
      content_text: 'Hello',
      content_html: undefined,
      summary: 'Hello',
      tags: [],
      content_type: 'article',
      fingerprint: 'fp-1',
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
      primary_topic: 'AI Developer Tools & Agents',
    },
  ];

  await writeSelectedSnapshot(snapshotPath, items);
  const saved = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Array<{ title: string }>;
  expect(saved[0]?.title).toBe('Post 1');

  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails if not yet added/imported correctly**

Run:
```bash
npx vitest run tests/static/selectedSnapshot.test.ts
```

Expected: FAIL until the new test imports are wired correctly.

- [ ] **Step 3: Update normal export to write snapshot after selection**

Add to `src/cli/exportStaticSite.ts`:

```ts
import { defaultSelectedSnapshotPath, writeSelectedSnapshot } from '../static/selectedSnapshot.js';
```

And after:

```ts
const { deduped, ordered, selected } = prepareDigestItems(ingestion.items, config.digest);
```

insert:

```ts
const selectedSnapshotPath = defaultSelectedSnapshotPath(outputDir, date);
await writeSelectedSnapshot(selectedSnapshotPath, selected);
logger.info(`Selected snapshot: ${selectedSnapshotPath}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/static/selectedSnapshot.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/exportStaticSite.ts src/static/selectedSnapshot.ts tests/static/selectedSnapshot.test.ts
git commit -m "feat: persist selected snapshot during static export"
```

### Task 3: Add render-from-snapshot recovery CLI

**Files:**
- Create: `src/cli/renderStaticSiteFromSnapshot.ts`
- Test: `tests/cli/renderStaticSiteFromSnapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSelectedSnapshot } from '../../src/static/selectedSnapshot.js';
import { exportStaticSite } from '../../src/static/exportStaticSite.js';

function makeItem(title: string, id: string) {
  return {
    id,
    source_name: 'Example',
    source_category: 'blog',
    source_url: 'https://example.com/feed.xml',
    item_url: `https://example.com/${id}`,
    title,
    published_at: null,
    fetched_at: new Date('2026-06-27T00:00:00.000Z'),
    author: '',
    content_text: 'Hello',
    content_html: undefined,
    summary: 'Hello',
    tags: [],
    content_type: 'article',
    fingerprint: `fp-${id}`,
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
    primary_topic: 'AI Developer Tools & Agents',
  };
}

describe('renderStaticSiteFromSnapshot flow', () => {
  it('renders html with the same digest-card count as snapshot items', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-static-from-snapshot-'));
    const outputDir = join(dir, 'site');
    const snapshotPath = join(outputDir, 'selected-2026-06-27.json');
    const items = [makeItem('Post 1', '1'), makeItem('Post 2', '2')];

    await writeSelectedSnapshot(snapshotPath, items);
    await exportStaticSite({
      outputDir,
      siteTitle: 'The Daily Scout',
      targetDate: '2026-06-27',
      items,
    });

    const html = readFileSync(join(outputDir, 'index.html'), 'utf8');
    expect((html.match(/class="digest-card"/g) || []).length).toBe(2);

    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/cli/renderStaticSiteFromSnapshot.test.ts
```

Expected: FAIL until the file/imports exist.

- [ ] **Step 3: Write the recovery CLI implementation**

```ts
import 'dotenv/config';
import { resolve } from 'node:path';
import { readSelectedSnapshot, defaultSelectedSnapshotPath } from '../static/selectedSnapshot.js';
import { exportStaticSite } from '../static/exportStaticSite.js';
import { defaultStaticSiteOutputDir } from '../static/exportStaticSiteCli.js';
import { enrichSelectedItems, DEFAULT_ENRICHMENT_CAP } from '../insights/enrichSelectedItems.js';
import { gateByLlmRelevance } from '../filtering/gateByLlmRelevance.js';

function readFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const date = readFlag('--date');
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: tsx src/cli/renderStaticSiteFromSnapshot.ts --date YYYY-MM-DD [--snapshot path] [--output-dir path]');
  process.exit(1);
}

const outputDir = resolve(readFlag('--output-dir') ?? defaultStaticSiteOutputDir());
const snapshotPath = resolve(readFlag('--snapshot') ?? defaultSelectedSnapshotPath(outputDir, date));
const selected = await readSelectedSnapshot(snapshotPath);
if (selected.length === 0) {
  console.error(`Selected snapshot is empty: ${snapshotPath}`);
  process.exit(1);
}

const enriched = await enrichSelectedItems(selected, DEFAULT_ENRICHMENT_CAP);
const gated = gateByLlmRelevance(enriched);
const result = await exportStaticSite({
  outputDir,
  siteTitle: 'The Daily Scout',
  targetDate: date,
  items: gated.items,
});

console.log(`Snapshot: ${snapshotPath}`);
console.log(`Selected: ${selected.length}`);
console.log(`Rendered: ${gated.items.length}`);
console.log(`Index: ${result.indexPath}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/cli/renderStaticSiteFromSnapshot.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/renderStaticSiteFromSnapshot.ts tests/cli/renderStaticSiteFromSnapshot.test.ts
git commit -m "feat: add static site render-from-snapshot cli"
```

### Task 4: Add package script and regression verification

**Files:**
- Modify: `package.json`
- Test: `tests/static/selectedSnapshot.test.ts`
- Test: `tests/cli/renderStaticSiteFromSnapshot.test.ts`

- [ ] **Step 1: Write the failing expectation**

We expect a recovery script entry:

```json
{
  "scripts": {
    "site:render-snapshot": "tsx src/cli/renderStaticSiteFromSnapshot.ts"
  }
}
```

- [ ] **Step 2: Add the script**

Modify `package.json` scripts block to include:

```json
"site:render-snapshot": "tsx src/cli/renderStaticSiteFromSnapshot.ts"
```

- [ ] **Step 3: Run targeted regression tests**

Run:
```bash
npx vitest run tests/static/selectedSnapshot.test.ts tests/cli/renderStaticSiteFromSnapshot.test.ts tests/fetchers/rssFetcher.test.ts tests/fetchers/fetchAllSources.test.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/capDigestItems.test.ts tests/coverage/supportStates.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Manual recovery verification**

Run:
```bash
npm run site:render-snapshot -- --date 2026-06-27
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('data/output/site/index.html', 'utf8');
console.log((html.match(/class="digest-card"/g) || []).length);
NODE
```

Expected:
- recovery CLI completes without ingestion
- the final number printed matches the rendered item count from the CLI

- [ ] **Step 5: Commit**

```bash
git add package.json src/cli/renderStaticSiteFromSnapshot.ts src/static/selectedSnapshot.ts tests/static/selectedSnapshot.test.ts tests/cli/renderStaticSiteFromSnapshot.test.ts
git commit -m "feat: add recoverable static site snapshot render path"
```
