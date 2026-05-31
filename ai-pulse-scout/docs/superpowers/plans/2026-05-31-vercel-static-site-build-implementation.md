# Vercel Static Site Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a no-argument static-site build entrypoint for Vercel that exports the correct digest date to `data/output/site` without breaking manual date-based exports.

**Architecture:** Extend the existing static export helper with an automatic target-date function based on the project’s Shanghai daily cutoff semantics, add a dedicated deployment CLI that reuses the current export pipeline, and expose it through a new npm script. Keep the existing manual `site:export -- --date ...` entrypoint unchanged.

**Tech Stack:** Node.js, TypeScript, tsx CLI scripts, existing AI Pulse Scout static export pipeline, Vitest.

---

## File Structure / Responsibility Map

- Modify: `src/static/exportStaticSiteCli.ts`
  - Keep date/window helpers and add automatic deployment target-date computation.
- Create: `src/cli/buildStaticSite.ts`
  - No-argument deployment CLI for Vercel.
- Modify: `src/cli/exportStaticSite.ts`
  - Optionally extract shared flow only if needed to avoid duplication while preserving current CLI behavior.
- Modify: `package.json`
  - Add `build:site` npm script.
- Modify: `tests/static/exportStaticSiteCli.test.ts`
  - Add coverage for automatic target-date logic.
- Create or modify: `tests/static/buildStaticSite.test.ts`
  - Verify the deployment build path runs without arguments and writes expected output.

### Task 1: Add helper tests for automatic digest-date selection

**Files:**
- Modify: `tests/static/exportStaticSiteCli.test.ts`
- Test: `src/static/exportStaticSiteCli.ts`

- [ ] **Step 1: Add a failing test for cutoff-before-07:00 behavior**
- [ ] **Step 2: Add a failing test for cutoff-at-or-after-07:00 behavior**
- [ ] **Step 3: Run `npx vitest run tests/static/exportStaticSiteCli.test.ts` and confirm failure**
- [ ] **Step 4: Implement the helper and rerun the test until it passes**
- [ ] **Step 5: Commit the helper behavior**

### Task 2: Add a deployment CLI and script wiring

**Files:**
- Create: `src/cli/buildStaticSite.ts`
- Modify: `package.json`
- Test: `tests/static/buildStaticSite.test.ts`

- [ ] **Step 1: Add a failing test that invokes the new deployment-oriented behavior without manual date input**
- [ ] **Step 2: Implement the deployment CLI using the shared export path**
- [ ] **Step 3: Add `build:site` to `package.json`**
- [ ] **Step 4: Run `npx vitest run tests/static/buildStaticSite.test.ts tests/static/exportStaticSiteCli.test.ts` and confirm pass**
- [ ] **Step 5: Commit the deployment CLI wiring**

### Task 3: Verify end-to-end deployment build behavior

**Files:**
- Verify existing and new CLI entrypoints

- [ ] **Step 1: Run `npm run build:site` and confirm it succeeds without arguments**
- [ ] **Step 2: Verify `data/output/site/index.html` exists after the build**
- [ ] **Step 3: Verify a `data/output/site/days/YYYY-MM-DD.html` page exists for the chosen date**
- [ ] **Step 4: Re-run `npm run site:export -- --date 2026-05-31` to confirm the manual path still works**
- [ ] **Step 5: Commit the verified feature state**

---

## Self-Review

### Spec coverage
- no-argument deployment build: covered by Tasks 1–3
- reuse of cutoff semantics: covered by Task 1
- new npm script wiring: covered by Task 2
- preservation of manual export behavior: covered by Task 3

### Placeholder scan
- No TBD/TODO placeholders remain.

### Type consistency
- The plan consistently uses `build:site` as the deployment script and keeps `site:export -- --date ...` as the manual path.
