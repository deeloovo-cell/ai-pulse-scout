# Multi-Source Ingestion & Topic-Grouped Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Pulse Scout to ingest structured multi-category sources from `config/source-inbox.md`, process all new items across source types, and render a topic-grouped digest with a consistent `Key Insights (200–500 words) + source link` output shape.

**Architecture:** Parse a sectioned source inventory into explicit ingestion categories, dispatch sources through category-specific adapters, normalize all discovered items into a common schema, infer a primary display topic for each item, and render digest output grouped by topic. Preserve all configured sources, avoid ranking-based inclusion gates, and keep all discovered new items in the processing path.

**Tech Stack:** TypeScript, Node.js, Vitest, existing AI Pulse Scout adapters/fetchers/render pipeline

---

## File Structure

### Existing files to modify
- `config/source-inbox.md` — convert flat URL list into sectioned category source-of-truth
- `src/inbox/parseSourceInbox.ts` — parse section headers and categorized URLs
- `src/inbox/types.ts` — define structured source category types
- `src/inbox/classifySource.ts` — keep or adapt classification helpers for explicit categories and fallback checks
- `src/types/config.ts` — update config-facing types if the structured source model surfaces there
- `src/types/item.ts` — extend normalized item shape with topic/category metadata needed by rendering
- `src/adapters/types.ts` — define category-aware adapter contracts
- `src/adapters/feedAdapter.ts` — align feed ingestion with new source category dispatch
- `src/adapters/genericWebAdapter.ts` — align webpage/docs/community/papers handling with explicit categories
- `src/adapters/githubAdapter.ts` — align docs/reference or code-source behavior if still used in dispatch
- `src/adapters/youtubeAdapter.ts` — align YouTube ingestion with explicit category dispatch
- `src/inbox/buildSourceUniverse.ts` — build structured ingestion inventory from categorized source sections
- `src/jobs/runDailyDigest.ts` — process all new items without ranking gate and pass topic-grouped items to render
- `src/filtering/selectItems.ts` — remove ranking-based inclusion behavior while preserving dedupe/relevance helpers only where still needed
- `src/normalize/normalizeItem.ts` — include category/topic fields in normalized items
- `src/insights/analyzeKeyInsights.ts` — ensure output can support consistent 200–500 word key insights payloads across categories
- `src/render/renderHtmlEmail.ts` — group rendered output by topic
- `src/cli/validateSources.ts` — validate categorized source inventory
- `tests/parseSourceInbox.test.ts` — cover sectioned source file parsing
- `tests/classifySource.test.ts` — cover category mapping or fallback classification rules
- `tests/selectItems.test.ts` — cover no-ranking-gate behavior
- `tests/render.test.ts` — cover topic-grouped output rendering
- `tests/sourceCoverage.test.ts` — cover structured source inventory interpretation
- `tests/backfill.test.ts` — verify multi-item processing path is intact

### Potential new files
- `src/topics/inferPrimaryTopic.ts` — assign primary digest topic and optional internal tags
- `src/topics/topicOrder.ts` — stable display order for digest topics
- `tests/inferPrimaryTopic.test.ts` — topic inference behavior
- `tests/validateSources.test.ts` — optional CLI/config validation tests if current coverage is insufficient

---

### Task 1: Inspect current parsing, selection, and rendering behavior

**Files:**
- Modify: none
- Test: none

- [ ] **Step 1: Inspect current source parsing implementation**

Run:
```bash
sed -n '1,220p' src/inbox/parseSourceInbox.ts
```
Expected: existing parser behavior for flat `source-inbox.md` inventory is visible.

- [ ] **Step 2: Inspect current source/inbox types**

Run:
```bash
sed -n '1,220p' src/inbox/types.ts && printf '\n---\n' && sed -n '1,220p' src/types/item.ts
```
Expected: current source and item type shapes are visible.

- [ ] **Step 3: Inspect current item selection behavior**

Run:
```bash
sed -n '1,240p' src/filtering/selectItems.ts
```
Expected: current ranking or inclusion behavior is visible.

- [ ] **Step 4: Inspect current digest rendering behavior**

Run:
```bash
sed -n '1,260p' src/render/renderHtmlEmail.ts
```
Expected: current output shape and grouping logic are visible.

- [ ] **Step 5: Commit nothing for inspection-only task**

No commit for this task.

### Task 2: Add failing tests for structured source parsing

**Files:**
- Modify: `tests/parseSourceInbox.test.ts`
- Test: `tests/parseSourceInbox.test.ts`

- [ ] **Step 1: Write failing tests for sectioned `source-inbox.md` parsing**

Add tests covering:
```ts
import { describe, expect, it } from 'vitest';
import { parseSourceInbox } from '../src/inbox/parseSourceInbox';

describe('parseSourceInbox', () => {
  it('parses categorized sections in source-inbox markdown', () => {
    const markdown = `
## rss
- https://openai.com/news/rss.xml

## webpage
- https://openai.com/news/

## youtube
- https://www.youtube.com/@OpenAI
`;

    const result = parseSourceInbox(markdown);

    expect(result.sections.rss).toEqual(['https://openai.com/news/rss.xml']);
    expect(result.sections.webpage).toEqual(['https://openai.com/news/']);
    expect(result.sections.youtube).toEqual(['https://www.youtube.com/@OpenAI']);
  });

  it('preserves all URLs without flattening away category membership', () => {
    const markdown = `
## community
- https://news.ycombinator.com/

## papers
- https://arxiv.org/list/cs.AI/recent
`;

    const result = parseSourceInbox(markdown);

    expect(result.allUrls).toEqual([
      'https://news.ycombinator.com/',
      'https://arxiv.org/list/cs.AI/recent',
    ]);
    expect(result.categoryByUrl['https://news.ycombinator.com/']).toBe('community');
    expect(result.categoryByUrl['https://arxiv.org/list/cs.AI/recent']).toBe('papers');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/parseSourceInbox.test.ts
```
Expected: FAIL because `parseSourceInbox` does not yet return the structured shape expected by the new tests.

- [ ] **Step 3: Commit test-only work**

```bash
git add tests/parseSourceInbox.test.ts
git commit -m "test: add structured source inbox parsing coverage"
```

### Task 3: Implement structured source parsing and types

**Files:**
- Modify: `src/inbox/parseSourceInbox.ts`, `src/inbox/types.ts`
- Test: `tests/parseSourceInbox.test.ts`

- [ ] **Step 1: Define explicit source category types**

Update `src/inbox/types.ts` to include a concrete category union and structured parse result shape, for example:
```ts
export type SourceCategory =
  | 'rss'
  | 'webpage'
  | 'youtube'
  | 'community'
  | 'docs'
  | 'papers';

export interface ParsedSourceInbox {
  sections: Record<SourceCategory, string[]>;
  allUrls: string[];
  categoryByUrl: Record<string, SourceCategory>;
}
```

- [ ] **Step 2: Implement section-aware markdown parsing**

Update `src/inbox/parseSourceInbox.ts` so `parseSourceInbox(markdown)`:
```ts
const EMPTY_SECTIONS: Record<SourceCategory, string[]> = {
  rss: [],
  webpage: [],
  youtube: [],
  community: [],
  docs: [],
  papers: [],
};
```
It should:
- detect `## <category>` headers
- accept bullet list URLs under each section
- preserve input order
- populate `sections`, `allUrls`, and `categoryByUrl`
- reject or ignore malformed lines consistently with current style

- [ ] **Step 3: Run test to verify it passes**

Run:
```bash
npx vitest run tests/parseSourceInbox.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit parsing implementation**

```bash
git add src/inbox/types.ts src/inbox/parseSourceInbox.ts tests/parseSourceInbox.test.ts
git commit -m "feat: parse categorized source inbox sections"
```

### Task 4: Add failing tests for topic inference and topic-ordered rendering

**Files:**
- Create: `tests/inferPrimaryTopic.test.ts`
- Modify: `tests/render.test.ts`
- Test: `tests/inferPrimaryTopic.test.ts`, `tests/render.test.ts`

- [ ] **Step 1: Write failing tests for primary topic inference**

Create `tests/inferPrimaryTopic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { inferPrimaryTopic } from '../src/topics/inferPrimaryTopic';

describe('inferPrimaryTopic', () => {
  it('maps OpenAI items to Frontier Model Labs', () => {
    expect(
      inferPrimaryTopic({
        sourceUrl: 'https://openai.com/news/',
        title: 'OpenAI launches new model family',
        content: 'A new frontier model is available.',
      }),
    ).toBe('Frontier Model Labs');
  });

  it('maps robotics items to Robotics & Embodied AI', () => {
    expect(
      inferPrimaryTopic({
        sourceUrl: 'https://www.therobotreport.com/',
        title: 'New robotics platform',
        content: 'Robotics and embodied AI system update.',
      }),
    ).toBe('Robotics & Embodied AI');
  });
});
```

- [ ] **Step 2: Write failing render test for topic-grouped output**

Extend `tests/render.test.ts` with a case asserting rendered digest includes topic group headings before grouped items, for example:
```ts
expect(html).toContain('Frontier Model Labs');
expect(html).toContain('AI Developer Tools & Agents');
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/inferPrimaryTopic.test.ts tests/render.test.ts
```
Expected: FAIL because topic inference and topic-grouped rendering are not yet implemented.

- [ ] **Step 4: Commit test-only work**

```bash
git add tests/inferPrimaryTopic.test.ts tests/render.test.ts
git commit -m "test: add topic inference and grouped render coverage"
```

### Task 5: Implement topic inference and topic ordering

**Files:**
- Create: `src/topics/inferPrimaryTopic.ts`, `src/topics/topicOrder.ts`
- Modify: `src/types/item.ts`, `src/normalize/normalizeItem.ts`
- Test: `tests/inferPrimaryTopic.test.ts`

- [ ] **Step 1: Create stable topic constants**

Add `src/topics/topicOrder.ts`:
```ts
export const DIGEST_TOPICS = [
  'Frontier Model Labs',
  'AI Developer Tools & Agents',
  'Research & Papers',
  'Robotics & Embodied AI',
  'Industrial / Manufacturing AI',
  'AI Products & Platforms',
  'Community & Market Signals',
  'AI News Roundup',
] as const;

export type DigestTopic = (typeof DIGEST_TOPICS)[number];
```

- [ ] **Step 2: Implement heuristic topic inference**

Add `src/topics/inferPrimaryTopic.ts` with deterministic rules based on source URL, title, and content. Include fallback to `AI News Roundup`.

- [ ] **Step 3: Extend normalized item shape**

Update `src/types/item.ts` and `src/normalize/normalizeItem.ts` so normalized items carry:
```ts
primaryTopic: DigestTopic;
sourceCategory?: string;
```
Use `inferPrimaryTopic(...)` during normalization.

- [ ] **Step 4: Run topic tests to verify they pass**

Run:
```bash
npx vitest run tests/inferPrimaryTopic.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit topic implementation**

```bash
git add src/topics/inferPrimaryTopic.ts src/topics/topicOrder.ts src/types/item.ts src/normalize/normalizeItem.ts tests/inferPrimaryTopic.test.ts
git commit -m "feat: infer primary digest topics"
```

### Task 6: Add failing tests for no-ranking-gate behavior

**Files:**
- Modify: `tests/selectItems.test.ts`
- Test: `tests/selectItems.test.ts`

- [ ] **Step 1: Add failing test ensuring all new items are kept**

Add a case like:
```ts
it('keeps all new items instead of selecting a ranked subset', () => {
  const items = [
    { id: '1', title: 'Item 1', fingerprint: 'a' },
    { id: '2', title: 'Item 2', fingerprint: 'b' },
    { id: '3', title: 'Item 3', fingerprint: 'c' },
  ];

  const selected = selectItems(items, { maxItems: 1 });

  expect(selected).toHaveLength(3);
});
```
Adapt to the real function signature while preserving the assertion: no ranking gate removes otherwise-new items.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/selectItems.test.ts
```
Expected: FAIL because current selection logic still limits or ranks inclusion.

- [ ] **Step 3: Commit test-only work**

```bash
git add tests/selectItems.test.ts
git commit -m "test: cover no-ranking-gate item selection"
```

### Task 7: Implement keep-all-new-items selection logic

**Files:**
- Modify: `src/filtering/selectItems.ts`, `src/jobs/runDailyDigest.ts`, possibly `src/filtering/dedupeItems.ts`
- Test: `tests/selectItems.test.ts`, `tests/backfill.test.ts`

- [ ] **Step 1: Simplify selection to preserve all new deduped items**

Update `src/filtering/selectItems.ts` so it no longer drops items based on ranking/count caps. It should preserve all deduped new items and only perform stable ordering if needed.

- [ ] **Step 2: Ensure daily digest job does not reintroduce item caps**

Update `src/jobs/runDailyDigest.ts` so the processing path carries all new items through to digest assembly.

- [ ] **Step 3: Add/adjust regression coverage for multiple items from the same source**

Extend `tests/backfill.test.ts` or related tests so multiple items from one source remain in the processed output.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/selectItems.test.ts tests/backfill.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit selection behavior changes**

```bash
git add src/filtering/selectItems.ts src/jobs/runDailyDigest.ts src/filtering/dedupeItems.ts tests/selectItems.test.ts tests/backfill.test.ts
git commit -m "feat: process all new items without ranking gate"
```

### Task 8: Add failing tests for category-aware source dispatch

**Files:**
- Modify: `tests/sourceCoverage.test.ts`, `tests/classifySource.test.ts`
- Test: `tests/sourceCoverage.test.ts`, `tests/classifySource.test.ts`

- [ ] **Step 1: Add failing source coverage tests for category sections**

Add coverage assertions ensuring sectioned source inventory produces category-aware source records.

- [ ] **Step 2: Add failing classification/dispatch tests**

Extend `tests/classifySource.test.ts` so category-specific URLs route to expected source categories or dispatch keys.

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/sourceCoverage.test.ts tests/classifySource.test.ts
```
Expected: FAIL because current build/classify logic is not yet aligned with explicit sectioned categories.

- [ ] **Step 4: Commit test-only work**

```bash
git add tests/sourceCoverage.test.ts tests/classifySource.test.ts
git commit -m "test: add category-aware source dispatch coverage"
```

### Task 9: Implement category-aware source inventory and adapter dispatch

**Files:**
- Modify: `src/inbox/buildSourceUniverse.ts`, `src/inbox/classifySource.ts`, `src/adapters/types.ts`, `src/adapters/feedAdapter.ts`, `src/adapters/genericWebAdapter.ts`, `src/adapters/youtubeAdapter.ts`, `src/adapters/githubAdapter.ts`, `src/cli/validateSources.ts`
- Test: `tests/sourceCoverage.test.ts`, `tests/classifySource.test.ts`

- [ ] **Step 1: Update source inventory builder to preserve explicit category**

Modify `src/inbox/buildSourceUniverse.ts` so sources built from `parseSourceInbox(...)` retain explicit category membership from section headers.

- [ ] **Step 2: Update category classification helpers to use explicit category first**

Modify `src/inbox/classifySource.ts` so explicit section category wins, with URL heuristics only used as fallback/validation.

- [ ] **Step 3: Update adapter contract types for category-aware dispatch**

Modify `src/adapters/types.ts` so source records passed into adapters include category information.

- [ ] **Step 4: Update adapter dispatch paths**

Modify adapters and/or their callers so:
- `rss` uses feed adapter
- `webpage` uses generic web adapter
- `youtube` uses YouTube adapter
- `community` uses generic/community handling branch
- `docs` uses docs/reference handling branch
- `papers` uses papers handling branch

Keep implementation pragmatic: if `genericWebAdapter.ts` handles multiple categories internally, make that explicit rather than prematurely splitting files.

- [ ] **Step 5: Update source validation CLI**

Modify `src/cli/validateSources.ts` to validate structured sections and category-preserving inventory.

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/sourceCoverage.test.ts tests/classifySource.test.ts tests/parseSourceInbox.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit category-aware dispatch changes**

```bash
git add src/inbox/buildSourceUniverse.ts src/inbox/classifySource.ts src/adapters/types.ts src/adapters/feedAdapter.ts src/adapters/genericWebAdapter.ts src/adapters/youtubeAdapter.ts src/adapters/githubAdapter.ts src/cli/validateSources.ts tests/sourceCoverage.test.ts tests/classifySource.test.ts tests/parseSourceInbox.test.ts
git commit -m "feat: dispatch structured sources by category"
```

### Task 10: Implement topic-grouped digest rendering

**Files:**
- Modify: `src/render/renderHtmlEmail.ts`, possibly `src/jobs/runDailyDigest.ts`
- Test: `tests/render.test.ts`

- [ ] **Step 1: Group rendered items by primary topic in stable order**

Update `src/render/renderHtmlEmail.ts` to:
- bucket items by `primaryTopic`
- render topics in `DIGEST_TOPICS` order
- render topic heading only when that group has items
- keep per-item output as title + Key Insights + source link

- [ ] **Step 2: Ensure daily digest job passes enriched normalized items into render layer**

Update `src/jobs/runDailyDigest.ts` if necessary so render receives `primaryTopic`-enriched items.

- [ ] **Step 3: Run render tests to verify they pass**

Run:
```bash
npx vitest run tests/render.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit topic-grouped rendering**

```bash
git add src/render/renderHtmlEmail.ts src/jobs/runDailyDigest.ts tests/render.test.ts
git commit -m "feat: group digest output by topic"
```

### Task 11: Restructure `config/source-inbox.md` without deleting URLs

**Files:**
- Modify: `config/source-inbox.md`
- Test: `tests/parseSourceInbox.test.ts`, `tests/sourceCoverage.test.ts`

- [ ] **Step 1: Transform flat source list into explicit categorized sections**

Rewrite `config/source-inbox.md` so every current URL appears exactly once under one of:
- `## rss`
- `## webpage`
- `## youtube`
- `## community`
- `## docs`
- `## papers`

Preserve all existing URLs. Do not remove any source.

- [ ] **Step 2: Run parsing and coverage tests against real config**

Run:
```bash
npx vitest run tests/parseSourceInbox.test.ts tests/sourceCoverage.test.ts
```
Expected: PASS.

- [ ] **Step 3: Commit the normalized source inventory**

```bash
git add config/source-inbox.md
git commit -m "chore: normalize source inbox into category sections"
```

### Task 12: Full verification

**Files:**
- Modify: none unless fixes are required
- Test: `tests/parseSourceInbox.test.ts`, `tests/inferPrimaryTopic.test.ts`, `tests/selectItems.test.ts`, `tests/sourceCoverage.test.ts`, `tests/classifySource.test.ts`, `tests/render.test.ts`, `tests/backfill.test.ts`

- [ ] **Step 1: Run targeted test suite**

Run:
```bash
npx vitest run \
  tests/parseSourceInbox.test.ts \
  tests/inferPrimaryTopic.test.ts \
  tests/selectItems.test.ts \
  tests/sourceCoverage.test.ts \
  tests/classifySource.test.ts \
  tests/render.test.ts \
  tests/backfill.test.ts
```
Expected: PASS.

- [ ] **Step 2: Run source validation CLI**

Run:
```bash
npx tsx src/cli/validateSources.ts
```
Expected: success output with structured source inventory validation.

- [ ] **Step 3: Run a digest preview/dry run**

Run:
```bash
npx tsx src/cli/preview.ts
```
Expected: preview completes successfully and shows topic-grouped digest output without dropping new items due to ranking.

- [ ] **Step 4: Commit any final verification fixes if needed**

```bash
git add -A
git commit -m "test: verify multi-source ingestion pipeline"
```
Only do this step if verification required code changes.

---

## Self-Review

### Spec coverage
- Structured `source-inbox.md` source-of-truth: Tasks 2, 3, 11
- Six source categories: Tasks 2, 3, 8, 9, 11
- Category-specific reading/dispatch: Task 9
- Topic-grouped digest output: Tasks 4, 5, 10
- Consistent digest item shape: Tasks 5, 10
- No ranking gate and keep all new items: Tasks 6, 7
- Preserve all URLs and avoid removals: Task 11
- Verification and progress readiness: Task 12

### Placeholder scan
- No `TODO`/`TBD` placeholders included.
- Each code-touching task includes files, commands, and explicit target behavior.

### Type consistency
- Source categories consistently use: `rss`, `webpage`, `youtube`, `community`, `docs`, `papers`
- Topic labels consistently use the eight approved digest topics
- Normalized item field uses `primaryTopic`

---

Plan complete and saved to `docs/superpowers/plans/2026-05-25-multi-source-ingestion-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
