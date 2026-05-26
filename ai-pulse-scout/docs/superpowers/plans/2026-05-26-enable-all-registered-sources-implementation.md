# Enable All Registered Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable every registered source in `config/sources.yaml` for production runs while preserving the existing daily cutoff, dedupe, selection, rendering, and transparent support-state behavior.

**Architecture:** This rollout is intentionally configuration-first: expand the production source set by setting all registered sources to enabled, then verify the existing unified-ingestion pipeline processes the full registry without any bundled behavior changes. Verification should focus on real support-state outcomes and end-to-end counts rather than trying to cosmetically smooth failures.

**Tech Stack:** TypeScript, Vitest, YAML config, existing unified-ingestion adapters, npm scripts

---

## File Map

- Modify: `config/sources.yaml` — switch all registered sources to `enabled: true`
- Test/Verify: `tests/sourceCoverage.test.ts` — confirm existing source coverage assumptions still hold after the registry change if needed
- Verify: `src/cli/coverage.ts` — existing coverage command path for transparent support-state output
- Verify: `src/cli/sendTest.ts` — existing production-like digest path
- Verify: `src/jobs/runSourceCoverage.ts` — existing support-state aggregation path
- Verify: `src/jobs/runDailyDigest.ts` — existing end-to-end daily digest path using the broadened registry

### Task 1: Enable all registered sources in config

**Files:**
- Modify: `config/sources.yaml`

- [ ] **Step 1: Update every disabled source entry to enabled**

Change every source block matching this pattern:

```yaml
enabled: false
```

To:

```yaml
enabled: true
```

Do not change any of the following fields during this task:

```yaml
name:
category:
url:
type:
coverage_status:
```

- [ ] **Step 2: Sanity-scan the config for remaining disabled entries**

Run:

```bash
grep -n "enabled: false" config/sources.yaml
```

Expected: no output.

- [ ] **Step 3: Commit the config-only rollout change**

Run:

```bash
git add config/sources.yaml
git commit -m "feat: enable all registered sources"
```

Expected: one commit containing only the registry enablement change.

### Task 2: Verify source-coverage behavior on the broadened registry

**Files:**
- Verify: `tests/sourceCoverage.test.ts`
- Verify: `src/cli/coverage.ts`
- Verify: `src/jobs/runSourceCoverage.ts`

- [ ] **Step 1: Run the focused source-coverage regression test**

Run:

```bash
npx vitest run tests/sourceCoverage.test.ts
```

Expected: PASS. If it fails due to changed count assumptions, inspect whether the assertion is about enabled-source counts versus support-state logic.

- [ ] **Step 2: Run the production coverage command against the broadened registry**

Run:

```bash
npm run coverage
```

Expected: command exits `0` and reports a larger total enabled-source universe with a mixed support-state distribution (`production_supported`, `partial_supported`, `discoverable_only`, `broken`, possibly `deferred`).

- [ ] **Step 3: Record the observed high-level support-state distribution for the user update**

Capture from command output:

```text
total enabled source count
count by support state
examples of clearly broken/high-noise sources
```

No code change in this step; this is verification evidence collection.

### Task 3: Verify end-to-end digest behavior with all sources enabled

**Files:**
- Verify: `src/cli/sendTest.ts`
- Verify: `src/jobs/runDailyDigest.ts`

- [ ] **Step 1: Run the production-like digest path**

Run:

```bash
npm run send-test
```

Expected: command exits `0`. Output may include a larger fetched-item count and a mixed-quality source set; this is acceptable as long as the run completes under the existing rules.

- [ ] **Step 2: Capture the digest pipeline counts from the run output**

Collect these metrics from the output:

```text
total fetched items
after dedupe count
final selected digest count
whether an email send happened or was skipped
```

This step is evidence gathering only.

- [ ] **Step 3: Inspect generated digest HTML artifact if present**

Check for the latest digest artifact under:

```bash
ls -lt data/output | head
```

Expected: the latest HTML artifact exists if the run generated one.

### Task 4: Final verification and wrap-up

**Files:**
- Verify: `config/sources.yaml`
- Verify: git history / working tree state

- [ ] **Step 1: Reconfirm all registered sources are enabled**

Run:

```bash
grep -c "enabled: true" config/sources.yaml
grep -c "enabled: false" config/sources.yaml
```

Expected:
- first command returns the total registered source count
- second command returns `0`

- [ ] **Step 2: Check working tree state**

Run:

```bash
git status --short
```

Expected: only intentional runtime artifacts may appear; no accidental source-logic code edits should exist.

- [ ] **Step 3: Push the rollout commit to GitHub**

Run:

```bash
git push origin feature/ai-pulse-scout-mvp
```

Expected: the enable-all-sources config commit is available on the feature branch.

- [ ] **Step 4: Prepare the user-facing verification summary**

Summarize:

```text
commit hash for enable-all rollout
total enabled source count
support-state distribution
fetched / deduped / selected counts
whether send-test sent an email or skipped
notable broken/noisy source categories
```

This closes the rollout without claiming quality uniformity across all newly enabled sources.
