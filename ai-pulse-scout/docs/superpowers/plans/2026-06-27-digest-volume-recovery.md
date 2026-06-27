# Digest Volume Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover AI Pulse Scout daily digest volume by removing clearly dead feeds, expanding source caps, and making source diagnostics trustworthy.

**Architecture:** Keep the current ingestion and static-site pipeline shape, but reduce dead-weight sources in the registry and widen the candidate funnel before the existing LLM relevance gate. Add lightweight operator-facing diagnostics in the validation commands instead of introducing a separate observability subsystem.

**Tech Stack:** TypeScript, YAML config, Vitest, existing RSS ingestion/validation CLIs

---

## File map

- Modify: `config/sources.yaml`
  - Disable or remove feeds with deterministic dead statuses (404/410) confirmed by validation evidence.
- Modify: `src/filtering/capSourceItems.ts`
  - Raise the default per-source cap from 10 to 20.
- Modify: `src/ingest/ingestAllSources.ts`
  - Keep unified ingestion aligned with the new per-source cap and preserve diagnostics.
- Modify: `src/filtering/capDigestItems.ts`
  - Raise default source-family cap from 10 to 20 and add an explicit higher arXiv cap of 40.
- Modify: `src/cli/validateSources.ts`
  - Emit trustworthy summary counts and failure reason buckets.
- Modify: `src/cli/coverage.ts`
  - Fix contradictory reporting so command output matches actual inspected source results.
- Test: `tests/capSourceItems.test.ts`
  - Update direct unit expectations for the new per-source cap.
- Test: `tests/ingest/ingestAllSources.test.ts`
  - Verify the unified ingestion path keeps at most 20 items per source.
- Test: `tests/capDigestItems.test.ts`
  - Verify default family cap = 20 and arXiv family cap = 40.
- Test: `tests/cli/coverage.test.ts` or nearest existing coverage CLI test file
  - Verify coverage summary reflects mixed OK/empty/failed sources correctly.

## Task 1: Clean deterministic dead feeds from the source registry

**Files:**
- Modify: `config/sources.yaml`

- [ ] **Step 1: Snapshot the current dead-feed candidates from validation evidence**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
node - <<'JS'
const dead = [
  'OpenAI Research',
  'Anthropic News Official',
  'Meta AI',
  'Mistral AI',
  'Microsoft AI Blog',
  'Databricks AI and Machine Learning',
  'Fireworks AI',
  'Groq',
  'CrewAI Blog',
  'LlamaIndex Blog',
  'Flowise Blog',
  'NVIDIA Research Publications',
  'Figure AI News',
  'Boston Dynamics Blog',
  'Agility Robotics',
  'Dassault Systemes Blog',
  'PTC Blogs'
];
console.log(dead.join('\n'));
JS
```

Expected:
- a concrete list of 404/410 candidates to remove or disable,
- no 403/timeout/XML-only failures included in this task.

- [ ] **Step 2: Edit the registry to remove or disable only deterministic dead feeds**

Apply a minimal registry change. Preserve formatting and nearby notes for all remaining entries.

Expected after edit:
- all 404/410 entries listed in Step 1 are no longer enabled,
- 403/timeout/XML-problem entries remain present for later work.

- [ ] **Step 3: Run source validation to confirm dead entries are gone from the active set**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npm run validate-sources
```

Expected:
- removed/disabled 404/410 feeds no longer appear as enabled failures,
- summary totals reflect the reduced active source count.

- [ ] **Step 4: Commit Task 1**

```bash
git add config/sources.yaml
git commit -m "chore: remove dead rss feeds from source registry"
```

## Task 2: Expand the upstream per-source cap from 10 to 20

**Files:**
- Modify: `src/filtering/capSourceItems.ts`
- Modify: `src/ingest/ingestAllSources.ts`
- Test: `tests/capSourceItems.test.ts`
- Test: `tests/ingest/ingestAllSources.test.ts`

- [ ] **Step 1: Write or update the direct cap unit test to expect 20 items**

If the file already exists, update the expectation. If not, add a focused test like:

```ts
it('keeps the highest-ranked 20 items by default', () => {
  const items = Array.from({ length: 25 }, (_, index) => makeItem(index));
  const result = capSourceItems(items);
  expect(result.items).toHaveLength(20);
  expect(result.counts.raw).toBe(25);
  expect(result.counts.capped).toBe(20);
});
```

- [ ] **Step 2: Run the direct cap test to verify red**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/capSourceItems.test.ts
```

Expected before implementation update:
- FAIL because the default cap is still 10.

- [ ] **Step 3: Update the production default cap and ingestion call site**

Implement the minimal code change:

```ts
export function capSourceItems(items: NormalizedItem[], limit = 20): SourceCapResult {
```

and in unified ingestion:

```ts
const capped = capSourceItems(ingested.items, 20);
```

- [ ] **Step 4: Add or update the ingestion-path regression test**

Use a fake adapter returning >20 items from a single source and assert the unified result contains 20 items from that source.

Example shape:

```ts
expect(result.items).toHaveLength(20);
expect(result.results[0]?.diagnostics.capped).toBe(20);
```

- [ ] **Step 5: Run targeted tests to verify green**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts
```

Expected:
- PASS
- explicit proof that per-source cap is now 20 through both direct and ingestion-path tests.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/filtering/capSourceItems.ts src/ingest/ingestAllSources.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts
git commit -m "feat: raise per-source cap for digest ingestion"
```

## Task 3: Expand final family caps and special-case arXiv

**Files:**
- Modify: `src/filtering/capDigestItems.ts`
- Test: `tests/capDigestItems.test.ts`

- [ ] **Step 1: Add or update failing tests for family-cap behavior**

Cover two cases:
1. non-arXiv family limited to 20
2. arXiv family limited to 40

Test skeleton:

```ts
it('caps non-arxiv families at 20 by default', () => {
  const items = Array.from({ length: 25 }, (_, index) => makeHostItem('example.com', index));
  expect(capDigestItems(items, 100, 20)).toHaveLength(20);
});

it('allows up to 40 arxiv items before fallback fill', () => {
  const items = Array.from({ length: 50 }, (_, index) => makeArxivItem(index));
  expect(capDigestItems(items, 100, 20)).toHaveLength(40);
});
```

- [ ] **Step 2: Run the family-cap test to verify red**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/capDigestItems.test.ts
```

Expected before implementation update:
- FAIL because defaults still reflect family cap 10 and no arXiv override.

- [ ] **Step 3: Implement the new family-cap rules**

Apply minimal production logic updates:

```ts
export const DIGEST_SOURCE_FAMILY_CAP = 20;
export const DIGEST_ARXIV_FAMILY_CAP = 40;
```

and when selecting items:

```ts
const familyLimit = family === 'arxiv' ? DIGEST_ARXIV_FAMILY_CAP : sourceFamilyLimit;
if (count >= familyLimit) continue;
```

- [ ] **Step 4: Re-run the family-cap tests**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/capDigestItems.test.ts
```

Expected:
- PASS
- explicit proof that arXiv can contribute up to 40 while other families remain capped at 20.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/filtering/capDigestItems.ts tests/capDigestItems.test.ts
git commit -m "feat: relax digest family caps with arxiv override"
```

## Task 4: Make validation and coverage summaries trustworthy

**Files:**
- Modify: `src/cli/validateSources.ts`
- Modify: `src/cli/coverage.ts`
- Test: `tests/cli/coverage.test.ts` or equivalent existing CLI test file

- [ ] **Step 1: Inspect current summary logic and identify the contradiction source**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
sed -n '1,260p' src/cli/validateSources.ts
sed -n '1,260p' src/cli/coverage.ts
```

Expected:
- identify why `coverage:sources` currently reports empty-only results inconsistent with validation,
- locate the shared or divergent counting logic.

- [ ] **Step 2: Add a failing test for mixed source outcomes**

Add or update a test covering a source set with:
- one OK source with items
- one OK source with zero items
- one failed source

Expected summary assertions:

```ts
expect(summary.totalSources).toBe(3);
expect(summary.success).toBe(1);
expect(summary.empty).toBe(1);
expect(summary.failed).toBe(1);
expect(summary.discoveredPosts).toBeGreaterThan(0);
```

- [ ] **Step 3: Implement minimal summary fixes**

Refactor counting logic only as needed so both commands report:
- total enabled sources inspected
- success / empty / failed counts
- discovered item totals
- failure reason buckets for failed sources

Avoid introducing a new subsystem; keep changes local and operator-facing.

- [ ] **Step 4: Run targeted CLI diagnostics tests**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/cli/coverage.test.ts
```

Expected:
- PASS
- summary output reflects mixed outcomes correctly.

- [ ] **Step 5: Run both validation commands manually for real-world evidence**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npm run validate-sources
npm run coverage:sources
```

Expected:
- command summaries are internally consistent,
- coverage output no longer claims all sources are empty when validation evidence shows otherwise.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/cli/validateSources.ts src/cli/coverage.ts tests/cli/coverage.test.ts
git commit -m "fix: make source coverage summaries trustworthy"
```

## Task 5: Run focused verification, inspect diff, and push

**Files:**
- No new product files expected beyond prior tasks

- [ ] **Step 1: Run the focused verification suite**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
npx vitest run tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/capDigestItems.test.ts tests/cli/coverage.test.ts
```

Expected:
- all targeted tests pass.

- [ ] **Step 2: Inspect the final working tree**

Run:
```bash
cd /Users/aactest/Documents/github/ai-pulse-scout/ai-pulse-scout
git status --short
git diff -- config/sources.yaml src/filtering/capSourceItems.ts src/ingest/ingestAllSources.ts src/filtering/capDigestItems.ts src/cli/validateSources.ts src/cli/coverage.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/capDigestItems.test.ts tests/cli/coverage.test.ts
```

Expected:
- only the intended source-registry, cap, diagnostics, and test files are changed.

- [ ] **Step 3: Commit any remaining verification-aligned changes**

```bash
git add config/sources.yaml src/filtering/capSourceItems.ts src/ingest/ingestAllSources.ts src/filtering/capDigestItems.ts src/cli/validateSources.ts src/cli/coverage.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/capDigestItems.test.ts tests/cli/coverage.test.ts
git commit -m "chore: recover digest volume and harden source diagnostics"
```

- [ ] **Step 4: Push branch**

```bash
git push origin feature/ai-pulse-scout-mvp
```

## Spec coverage check

- Deterministic dead-feed cleanup: covered by Task 1.
- Per-source cap increase: covered by Task 2.
- Family cap increase + arXiv override: covered by Task 3.
- Trustworthy diagnostics and coverage fix: covered by Task 4.
- Commit/push requirement: covered by Task 5.

## Placeholder scan

No TODO/TBD placeholders remain. Each task names exact files, commands, expected outcomes, and concrete code-direction examples.

## Type consistency check

- Cap-related names match current code paths: `capSourceItems`, `ingestAllSources`, `capDigestItems`.
- The arXiv override is specified as an addition inside existing family-cap logic rather than a separate pipeline.
- Diagnostics changes are kept in existing CLI entrypoints rather than inventing new command surfaces.
