# Real score threshold implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate a real `relevance_scores.overall` score in the static digest flow, use that same score for static-page `match %`, and apply a `0.6` inclusion threshold before items enter the digest list.

**Architecture:** Keep one canonical score path on `NormalizedItem.relevance_scores.overall`. Compute or propagate that score before selection, let `selectItems(...)` filter on `>= 0.6`, and let the static renderer read the same field directly without synthesizing position-based match numbers.

**Tech Stack:** TypeScript, Vitest, existing AI Pulse Scout pipeline/export flow

---

### Task 1: Lock selection behavior with failing tests

**Files:**
- Modify: `tests/selectItems.test.ts`
- Test: `tests/selectItems.test.ts`

- [ ] **Step 1: Write the failing threshold test for `0.6`**

```ts
it('includes only items whose overall relevance score is at least 0.6', () => {
  const selected = selectItems([
    makeItem({ id: 'low', relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0.59 }, published_at: new Date('2026-05-20T08:00:00Z') }),
    makeItem({ id: 'threshold', relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0.6 }, published_at: new Date('2026-05-20T10:00:00Z') }),
    makeItem({ id: 'high', relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0.91 }, published_at: new Date('2026-05-20T12:00:00Z') }),
  ]);

  expect(selected.map((item) => item.id)).toEqual(['high', 'threshold']);
  expect(selected[0].decision_reason).toBe('included: overall relevance >= 0.6');
});
```

- [ ] **Step 2: Run test to verify it fails against the current `0.85` rule**

Run:
```bash
npx vitest run tests/selectItems.test.ts
```

Expected: FAIL because `threshold` at `0.6` is still excluded by the old threshold.

- [ ] **Step 3: Update the implementation to use `0.6`**

```ts
const MIN_OVERALL_RELEVANCE = 0.6;
...
decision_reason: 'included: overall relevance >= 0.6',
```

- [ ] **Step 4: Re-run the selection test**

Run:
```bash
npx vitest run tests/selectItems.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the threshold-only change**

```bash
git add tests/selectItems.test.ts src/filtering/selectItems.ts
git commit -m "feat: lower digest threshold to real score 0.6"
```

### Task 2: Lock static-page match rendering to the real score

**Files:**
- Modify: `tests/static/renderStaticSite.test.ts`
- Modify: `src/static/renderStaticSite.ts`
- Test: `tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Add failing renderer tests**

```ts
it('renders match percentage directly from the real overall relevance score', () => {
  const html = renderStaticIndexPage({
    siteTitle: 'The Daily Scout',
    targetDate: '2026-05-30',
    recentDays: ['2026-05-30'],
    items: [makeItem({ relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0.63 } })],
  });

  expect(html).toContain('63% match');
});

it('does not render a synthetic match percentage when the real score is unavailable', () => {
  const html = renderStaticIndexPage({
    siteTitle: 'The Daily Scout',
    targetDate: '2026-05-30',
    recentDays: ['2026-05-30'],
    items: [makeItem({ relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 } })],
  });

  expect(html).not.toContain('% match');
});
```

- [ ] **Step 2: Run renderer test to verify it fails**

Run:
```bash
npx vitest run tests/static/renderStaticSite.test.ts
```

Expected: FAIL because the current renderer fabricates `61..95` percentages and still shows a match pill for zero-score items.

- [ ] **Step 3: Replace synthetic display scoring with direct real-score rendering**

```ts
function getDisplayMatch(item: NormalizedItem): number | null {
  const explicitScore = item.relevance_scores?.overall;
  if (typeof explicitScore !== 'number' || !Number.isFinite(explicitScore) || explicitScore <= 0) {
    return null;
  }

  return Math.round(explicitScore * 100);
}
```

And render conditionally:

```ts
const match = getDisplayMatch(item);
...
${match === null ? '' : `<span class="match-pill match-${getMatchTone(match)}">${match}% match</span>`}
```

- [ ] **Step 4: Re-run the renderer test**

Run:
```bash
npx vitest run tests/static/renderStaticSite.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the renderer alignment**

```bash
git add tests/static/renderStaticSite.test.ts src/static/renderStaticSite.ts
git commit -m "feat: show real score on static match pills"
```

### Task 3: Wire a real score into the static digest flow

**Files:**
- Modify: `src/insights/analyzeKeyInsights.ts`
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `src/jobs/runPipeline.ts` (only if needed for propagation)
- Test: `tests/jobs/runDailyDigest.pipeline.test.ts`
- Test: `tests/analyzeKeyInsights.test.ts`

- [ ] **Step 1: Add a failing test that enrichment preserves a non-zero real score**

```ts
it('preserves the item relevance score when attaching fallback insight', async () => {
  const item = makeItem({
    relevance_scores: { ai_engineering: 0.8, industrial_ai: 0.4, cad_cae_cam: 0.2, executive_signal: 0.5, aac_relevance: 0.6, overall: 0.63 },
  });

  const result = await enrichSingleItem(item, {});

  expect(result.relevance_scores.overall).toBe(0.63);
});
```

- [ ] **Step 2: Add a failing pipeline/export-oriented test proving selected items can carry non-zero match scores into downstream consumers**

```ts
expect(savedItems[0].matchScore).toBe(0.63);
```

- [ ] **Step 3: Implement the minimal propagation fix**

Use the existing `NormalizedItem.relevance_scores.overall` as the canonical real score and ensure enrichment/fallback paths do not erase or replace it with zero. If the current path already preserves the field, keep the implementation minimal and tighten tests around the real non-zero path rather than adding speculative score synthesis.

- [ ] **Step 4: Run focused pipeline/enrichment tests**

Run:
```bash
npx vitest run tests/analyzeKeyInsights.test.ts tests/jobs/runDailyDigest.pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the score-path fix**

```bash
git add tests/analyzeKeyInsights.test.ts tests/jobs/runDailyDigest.pipeline.test.ts src/insights/analyzeKeyInsights.ts src/jobs/runDailyDigest.ts src/jobs/runPipeline.ts
git commit -m "test: lock real score propagation through digest flow"
```

### Task 4: Verify real counts for the `0.6` threshold

**Files:**
- Modify: `src/filtering/selectItems.ts` (if Task 1 not already finished)
- Modify: `src/static/renderStaticSite.ts` (if Task 2 not already finished)
- Output check: `data/output/site/index.html`
- Output check: `data/output/site/days/2026-05-31.html`

- [ ] **Step 1: Run the focused suites together**

Run:
```bash
npx vitest run tests/selectItems.test.ts tests/static/renderStaticSite.test.ts tests/analyzeKeyInsights.test.ts tests/jobs/runDailyDigest.pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 2: Re-export the target day**

Run:
```bash
npm run site:export -- --date 2026-05-31
```

Expected: export succeeds and logs item counts.

- [ ] **Step 3: Count items above and below the `0.6` threshold from export-ready data**

Run:
```bash
python3 - <<'PY'
from pathlib import Path
import re
html = Path('data/output/site/index.html').read_text()
print('digest_cards', len(re.findall(r'<article class="digest-card">', html)))
print('match_pills', len(re.findall(r'% match</span>', html)))
PY
```

Expected: concrete counts you can report back to the user.

- [ ] **Step 4: Manually inspect that low-score synthetic percentages are gone**

Check that exported HTML does not depend on rank-position-based fallback percentages and that rendered match pills correspond only to real scored items.

- [ ] **Step 5: Commit verified implementation**

```bash
git add src/filtering/selectItems.ts src/static/renderStaticSite.ts tests/selectItems.test.ts tests/static/renderStaticSite.test.ts tests/analyzeKeyInsights.test.ts tests/jobs/runDailyDigest.pipeline.test.ts
git commit -m "feat: align digest selection and page match to real score"
```

### Task 5: Release the change if requested

**Files:**
- Modify: none required beyond prior tasks

- [ ] **Step 1: Push the branch**

Run:
```bash
git push origin feature/ai-pulse-scout-mvp
```

Expected: branch updates on remote.

- [ ] **Step 2: Publish the static site**

Run:
```bash
npm run publish:site
```

Expected: successful publish and deploy-hook trigger.

- [ ] **Step 3: Verify the live page**

Run:
```bash
python3 - <<'PY'
import urllib.request
html = urllib.request.urlopen('https://daily.deanlu.ai').read().decode('utf-8', 'ignore')
print('match-pill', '% match' in html)
print('daily scout', 'The Daily Scout' in html)
PY
```

Expected: live production reflects the updated real-score rendering.

- [ ] **Step 4: Report final counts under the `0.6` rule**

Report:
- how many items were deduped
- how many met `>= 0.6`
- how many were excluded below threshold
- how many rendered to the final static digest

- [ ] **Step 5: Commit any final verification-only updates if needed**

```bash
git status
```

Expected: clean or intentionally dirty only from local generated artifacts.
