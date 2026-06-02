# Static-site-only runtime and per-source cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make static publishing the explicit daily production path, keep the 07:00 schedule pointed at static publishing, and verify/enforce a per-source item cap of 10 in the static-site pipeline.

**Architecture:** Leave the existing static publishing runtime in place and make the intended production behavior explicit in docs/config comments. Reuse the existing source-cap mechanism, add focused regression coverage around the static-site path, and only touch code where a real behavior gap exists.

**Tech Stack:** TypeScript, Vitest, bash/launchd, YAML config, static-site CLI pipeline

---

## File map

- Modify: `config/digest.yaml`
  - Clarify that email is not the active production output path and that static publishing is the current daily runtime focus.
- Modify: `scripts/install-schedule.sh`
  - Tighten wording so install output explicitly refers to static-site publishing at 07:00.
- Modify: `scripts/com.ai-pulse-scout.daily.plist`
  - Keep target unchanged, but align comments to static publishing language if needed.
- Modify: `src/ingest/ingestAllSources.ts`
  - Only if verification shows the source cap is not explicit enough in the static pipeline behavior.
- Test: `tests/capSourceItems.test.ts`
  - Preserve direct unit coverage for per-source cap = 10.
- Test: `tests/cli/publishStaticSite.test.ts`
  - Add or tighten coverage that the publish-static-site flow remains the active scheduled path.
- Test: `tests/ingest/ingestAllSources.test.ts` or nearest existing ingestion/static-site test file
  - Add a focused regression test that a single source contributing >10 AI-relevant items is capped before downstream static selection.
- Modify: `docs/superpowers/specs/2026-06-02-static-site-only-and-source-cap-design.md`
  - Only if implementation reveals a wording mismatch.

## Task 1: Clarify production runtime as static-site-only

**Files:**
- Modify: `config/digest.yaml`
- Modify: `scripts/install-schedule.sh`
- Modify: `scripts/com.ai-pulse-scout.daily.plist`

- [ ] **Step 1: Add a failing wording test or choose the lightest existing verification point**

Because these are config/script wording changes rather than functional code, use direct file-content verification instead of introducing fake runtime logic tests.

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
rg -n "email|static|07:00|publish" config/digest.yaml scripts/install-schedule.sh scripts/com.ai-pulse-scout.daily.plist
```

Expected before change:
- wording is mixed or incomplete,
- static publishing is not consistently described as the primary production path,
- email wording may still read like an active digest path.

- [ ] **Step 2: Update config/script wording with minimal changes**

Apply edits like this (preserve existing behavior; only change wording/comments/output text):

```yaml
# config/digest.yaml
# AI Pulse Scout -- Digest Configuration
# Note: production delivery currently uses generated static pages.
# Email sending is not the active production path.

digest:
  # Max recent posts to include in each digest.
  # This config remains for shared selection logic even though production output is the static site.
  max_items: 18
```

```bash
# scripts/install-schedule.sh
echo ""
echo "Scheduled: daily static-site publish at 07:00 host local time"
```

```xml
<!-- scripts/com.ai-pulse-scout.daily.plist -->
<!-- Fire every day at 07:00 host local time for static-site publishing -->
```

- [ ] **Step 3: Verify wording changes landed correctly**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
rg -n "static-site|static site|Email sending is not the active production path|07:00" config/digest.yaml scripts/install-schedule.sh scripts/com.ai-pulse-scout.daily.plist
```

Expected:
- all three files show static publishing as the production runtime intent,
- no behavioral script target change,
- 07:00 language remains intact.

- [ ] **Step 4: Commit Task 1**

```bash
git add config/digest.yaml scripts/install-schedule.sh scripts/com.ai-pulse-scout.daily.plist
git commit -m "docs: clarify static-site-only production runtime"
```

## Task 2: Prove per-source cap = 10 in the static pipeline

**Files:**
- Test: `tests/ingest/ingestAllSources.test.ts` or create it if absent
- Modify: `src/ingest/ingestAllSources.ts` only if the test reveals a gap
- Test: `tests/capSourceItems.test.ts`

- [ ] **Step 1: Inspect current ingestion/static source-cap flow**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
sed -n '1,220p' src/ingest/ingestAllSources.ts
sed -n '1,220p' tests/capSourceItems.test.ts
```

Expected:
- confirm where `capSourceItems(..., 10)` is applied,
- determine the best test seam for the static pipeline path.

- [ ] **Step 2: Write a failing ingestion/static-path regression test**

Target behavior:
- when one source yields more than 10 AI-relevant items in-window,
- the unified ingestion result passed downstream contains at most 10 from that source.

Test skeleton:

```ts
it('caps each source to 10 items before downstream static selection', async () => {
  const source = { name: 'Test Feed', type: 'rss', url: 'https://example.com/feed.xml', enabled: true, category: 'blog' };
  const items = Array.from({ length: 14 }, (_, index) => makeItem({
    id: `item-${index + 1}`,
    title: `Item ${index + 1}`,
    source_name: 'Test Feed',
    relevance_scores: { overall: 0.9, ai_engineering: 0.9, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0 },
  }));

  const result = await ingestAllSources({
    sources: [source],
    windowStart: new Date('2026-06-01T00:00:00.000Z'),
    windowEnd: new Date('2026-06-02T00:00:00.000Z'),
    adapters: [fakeAdapterReturning(items)],
  });

  expect(result.items).toHaveLength(10);
  expect(new Set(result.items.map((item) => item.source_name))).toEqual(new Set(['Test Feed']));
});
```

- [ ] **Step 3: Run the targeted test to verify red**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
npx vitest run tests/ingest/ingestAllSources.test.ts
```

Expected before implementation adjustment:
- either FAIL because the test file/behavior does not exist yet,
- or FAIL because the cap is not asserted through this path yet.

- [ ] **Step 4: Implement the minimal code change only if red proves a real gap**

If `src/ingest/ingestAllSources.ts` already applies `capSourceItems(ingested.items, 10)`, do not change production logic. Only keep the new test.

If there is a bypass path, patch it minimally, e.g.:

```ts
const capped = capSourceItems(ingested.items, 10);
summary.sources.push({ ...existing, counts: capped.counts });
items.push(...capped.items);
```

- [ ] **Step 5: Run targeted source-cap tests to verify green**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
npx vitest run tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts
```

Expected:
- PASS
- explicit proof that per-source cap 10 is preserved in the static pipeline input.

- [ ] **Step 6: Commit Task 2**

```bash
git add tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts src/ingest/ingestAllSources.ts
git commit -m "test: verify per-source cap in static pipeline"
```

## Task 3: Verify schedule points to static publishing at 07:00

**Files:**
- No code changes expected unless verification reveals drift

- [ ] **Step 1: Check installed schedule state**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
launchctl list com.ai-pulse-scout.daily | sed -n '1,120p'
cat ~/Library/LaunchAgents/com.ai-pulse-scout.daily.plist
```

Expected:
- label is `com.ai-pulse-scout.daily`
- `ProgramArguments` points to `scripts/publish-static-site.sh`
- calendar interval is hour 7 minute 0.

- [ ] **Step 2: Reinstall schedule only if the installed plist has drifted**

Run only if needed:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
bash scripts/install-schedule.sh
```

Expected:
- launch agent reloaded cleanly,
- printed schedule text still says daily static-site publish at 07:00.

- [ ] **Step 3: Record verification evidence in the final report**

No code block needed. Include:
- task label,
- 07:00 confirmation,
- publish-static-site target confirmation.

## Task 4: Run final verification and commit any remaining aligned changes

**Files:**
- Modify only if earlier tasks required touch-ups

- [ ] **Step 1: Run focused verification suite**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
npx vitest run tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/cli/publishStaticSite.test.ts
```

Expected:
- all targeted tests pass.

- [ ] **Step 2: Check git diff for unintended spillover**

Run:
```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout
git status --short
git diff -- config/digest.yaml scripts/install-schedule.sh scripts/com.ai-pulse-scout.daily.plist src/ingest/ingestAllSources.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/cli/publishStaticSite.test.ts
```

Expected:
- only files relevant to this plan are changed.

- [ ] **Step 3: Commit final verification-aligned changes**

```bash
git add config/digest.yaml scripts/install-schedule.sh scripts/com.ai-pulse-scout.daily.plist src/ingest/ingestAllSources.ts tests/capSourceItems.test.ts tests/ingest/ingestAllSources.test.ts tests/cli/publishStaticSite.test.ts
git commit -m "chore: align static daily runtime and source cap verification"
```

- [ ] **Step 4: Push branch**

```bash
git push origin feature/ai-pulse-scout-mvp
```

## Spec coverage check

- Static-site-only runtime: covered by Task 1 and Task 3.
- 07:00 schedule confirmation: covered by Task 3.
- Per-source cap = 10 verification in static path: covered by Task 2.
- Commit/push requirement: covered by Tasks 1, 2, and 4.

## Placeholder scan

No TODO/TBD placeholders remain. All tasks name exact files, commands, expected outcomes, and minimal code direction.

## Type consistency check

- Existing runtime names remain unchanged: `publish-static-site.sh`, `com.ai-pulse-scout.daily`, `capSourceItems`, `ingestAllSources`.
- The plan only introduces `tests/ingest/ingestAllSources.test.ts` if an equivalent focused test file does not already exist.
