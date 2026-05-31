# AI Pulse Scout Static Site Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal local static-site export path that reruns the digest flow for a target day and writes `site/index.html` plus `site/days/YYYY-MM-DD.html`.

**Architecture:** Keep the existing digest pipeline as the source of truth for final items, add a focused website renderer/exporter pair, and expose a small CLI that drives target-day export without introducing deploy transport or reusing the interactive review server.

**Tech Stack:** Node.js, TypeScript, existing AI Pulse Scout pipeline, file-system output, Vitest.

---

## File Structure / Responsibility Map

- Create: `src/static/renderStaticSite.ts`
  - Render homepage and day archive HTML for website output.
- Create: `src/static/exportStaticSite.ts`
  - Write `site/index.html` and `site/days/YYYY-MM-DD.html`.
- Create: `src/cli/exportStaticSite.ts`
  - Parse target date and run export flow.
- Modify: `package.json`
  - Add a script for static-site export.
- Create: `tests/static/renderStaticSite.test.ts`
  - Verify homepage/day-page HTML behavior.
- Create: `tests/static/exportStaticSite.test.ts`
  - Verify output files are written to expected paths.
- Optionally modify: `README.md`
  - Document the new local export command.

---

### Task 1: Add failing tests for website rendering

**Files:**
- Create: `tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Write failing render tests**
- [ ] **Step 2: Run `npx vitest run tests/static/renderStaticSite.test.ts` and confirm failure**
- [ ] **Step 3: Commit the failing tests**

### Task 2: Implement static site renderer

**Files:**
- Create: `src/static/renderStaticSite.ts`
- Test: `tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Implement homepage renderer with recent-days list and digest items**
- [ ] **Step 2: Implement archive page renderer with homepage backlink**
- [ ] **Step 3: Run `npx vitest run tests/static/renderStaticSite.test.ts` and confirm pass**
- [ ] **Step 4: Commit the renderer**

### Task 3: Add failing tests for exporter output

**Files:**
- Create: `tests/static/exportStaticSite.test.ts`

- [ ] **Step 1: Write failing export tests for `site/index.html` and `site/days/YYYY-MM-DD.html`**
- [ ] **Step 2: Run `npx vitest run tests/static/exportStaticSite.test.ts` and confirm failure**
- [ ] **Step 3: Commit the failing tests**

### Task 4: Implement filesystem export

**Files:**
- Create: `src/static/exportStaticSite.ts`
- Test: `tests/static/exportStaticSite.test.ts`

- [ ] **Step 1: Implement directory creation and file writes**
- [ ] **Step 2: Run `npx vitest run tests/static/exportStaticSite.test.ts` and confirm pass**
- [ ] **Step 3: Commit the exporter**

### Task 5: Add CLI entrypoint and script wiring

**Files:**
- Create: `src/cli/exportStaticSite.ts`
- Modify: `package.json`

- [ ] **Step 1: Add CLI to accept `--date YYYY-MM-DD` and optional output dir**
- [ ] **Step 2: Reuse the existing digest/backfill-compatible path as much as possible to obtain target-day final items**
- [ ] **Step 3: Add an npm script such as `site:export`**
- [ ] **Step 4: Run a smoke command for the CLI**
- [ ] **Step 5: Commit the CLI wiring**

### Task 6: Document and verify the end-to-end local export path

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the static export command briefly**
- [ ] **Step 2: Run focused static export tests**
- [ ] **Step 3: Run full `npm test`**
- [ ] **Step 4: Run the real local export for `2026-05-30` and inspect output paths**
- [ ] **Step 5: Commit the verified feature state**

---

## Self-Review

### Spec coverage
- homepage + archive page output: covered by Tasks 1–4
- recent-days navigation: covered by Tasks 1–2
- local target-day export CLI: covered by Task 5
- local verification and real 2026-05-30 run: covered by Task 6

### Placeholder scan
- No TBD/TODO placeholders remain in the plan structure, but exact implementation details should be adapted to current backfill/pipeline APIs after inspecting existing code.

### Type consistency
- New static renderer/exporter should accept the same digest item shape already used by current render flows wherever practical.
