# Checkpoint-Based Static Publish Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 07:00-based static publish ingest window with a rolling checkpoint window based on the previous successful publish completion and the current run start.

**Architecture:** Introduce a small checkpoint state utility that resolves the effective ingest window once per publish run, pass explicit window overrides into static-site build code, and advance the checkpoint only after build + deploy both succeed. Keep 07:00 as a launch trigger only.

**Tech Stack:** TypeScript, tsx, Vitest, shell scripts, JSON state file

---

## File map

- Modify: `src/cli/publishStaticSite.ts` — own run lifecycle, compute effective window, call build + deploy, update checkpoint on success
- Modify: `src/cli/buildStaticSite.ts` — accept explicit window inputs from the publish flow
- Modify: `src/static/exportStaticSiteCli.ts` — expose/build with explicit window overrides without recomputing fixed 07:00 boundaries
- Create: `src/state/staticSitePublishCheckpoint.ts` — read/write checkpoint and resolve effective window
- Create: `tests/state/staticSitePublishCheckpoint.test.ts` — checkpoint resolution tests
- Modify: `tests/dailyWindow.test.ts` or add targeted tests for explicit-window behavior — verify old fixed-window path still works only when used directly
- Modify: `scripts/publish-static-site.sh` — keep as orchestration wrapper, rely on TS publish flow for window semantics

### Task 1: Add checkpoint state utility

**Files:**
- Create: `src/state/staticSitePublishCheckpoint.ts`
- Test: `tests/state/staticSitePublishCheckpoint.test.ts`

- [ ] **Step 1: Write failing tests for checkpoint resolution and persistence**

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readStaticSitePublishCheckpoint,
  resolveStaticSitePublishWindow,
  writeStaticSitePublishCheckpoint,
} from '../../src/state/staticSitePublishCheckpoint';

describe('staticSitePublishCheckpoint', () => {
  it('uses previous successful completion as window start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');
    writeStaticSitePublishCheckpoint(checkpointPath, {
      lastSuccessfulFetchCompletedAt: '2026-06-01T07:32:18.000Z',
      runStartedAt: '2026-06-02T07:00:00.000Z',
      completedAt: '2026-06-02T07:41:00.000Z',
    });

    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-01T07:32:18.000Z');
    expect(resolved.windowEnd.toISOString()).toBe('2026-06-03T07:00:00.000Z');
    expect(resolved.source).toBe('checkpoint');
  });

  it('falls back to 24h before run start when checkpoint is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'missing.json');
    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    expect(resolved.windowEnd.toISOString()).toBe('2026-06-03T07:00:00.000Z');
    expect(resolved.source).toBe('fallback_24h');
  });

  it('falls back to 24h before run start when checkpoint is malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');
    require('node:fs').writeFileSync(checkpointPath, '{"lastSuccessfulFetchCompletedAt":"nope"}');

    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    expect(resolved.source).toBe('fallback_24h');
  });

  it('writes checkpoint payload after success', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');

    writeStaticSitePublishCheckpoint(checkpointPath, {
      lastSuccessfulFetchCompletedAt: '2026-06-03T07:41:00.000Z',
      runStartedAt: '2026-06-03T07:00:00.000Z',
      completedAt: '2026-06-03T07:41:00.000Z',
    });

    const raw = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    expect(raw.lastSuccessfulFetchCompletedAt).toBe('2026-06-03T07:41:00.000Z');
    expect(readStaticSitePublishCheckpoint(checkpointPath)?.lastSuccessfulFetchCompletedAt).toBe('2026-06-03T07:41:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/state/staticSitePublishCheckpoint.test.ts`
Expected: FAIL because module does not exist yet

- [ ] **Step 3: Implement minimal checkpoint utility**

```ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface StaticSitePublishCheckpoint {
  lastSuccessfulFetchCompletedAt: string;
  runStartedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export function readStaticSitePublishCheckpoint(path: string): StaticSitePublishCheckpoint | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as StaticSitePublishCheckpoint;
    const ts = parsed.lastSuccessfulFetchCompletedAt;
    if (!ts || Number.isNaN(new Date(ts).getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveStaticSitePublishWindow({ checkpointPath, runStartedAt }: { checkpointPath: string; runStartedAt: Date }) {
  const checkpoint = readStaticSitePublishCheckpoint(checkpointPath);
  const windowEnd = runStartedAt;
  if (checkpoint) {
    return {
      windowStart: new Date(checkpoint.lastSuccessfulFetchCompletedAt),
      windowEnd,
      source: 'checkpoint' as const,
    };
  }
  return {
    windowStart: new Date(runStartedAt.getTime() - 24 * 60 * 60 * 1000),
    windowEnd,
    source: 'fallback_24h' as const,
  };
}

export function writeStaticSitePublishCheckpoint(path: string, checkpoint: StaticSitePublishCheckpoint): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ ...checkpoint, updatedAt: checkpoint.completedAt ?? checkpoint.lastSuccessfulFetchCompletedAt }, null, 2) + '\n',
    'utf8',
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/state/staticSitePublishCheckpoint.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/staticSitePublishCheckpoint.ts tests/state/staticSitePublishCheckpoint.test.ts
git commit -m "feat: add static publish checkpoint state"
```

### Task 2: Thread explicit window overrides into static site build

**Files:**
- Modify: `src/static/exportStaticSiteCli.ts`
- Modify: `src/cli/buildStaticSite.ts`
- Test: existing daily window/static build tests plus a new targeted test if needed

- [ ] **Step 1: Add failing test for explicit window override support**

```ts
it('prefers explicit window overrides over digest-date-derived daily window', () => {
  const result = resolveStaticSiteBuildWindow({
    digestDate: '2026-06-03',
    windowStartIso: '2026-06-01T07:32:18.000Z',
    windowEndIso: '2026-06-02T07:00:00.000Z',
  });

  expect(result.windowStart.toISOString()).toBe('2026-06-01T07:32:18.000Z');
  expect(result.windowEnd.toISOString()).toBe('2026-06-02T07:00:00.000Z');
  expect(result.source).toBe('explicit');
});
```

- [ ] **Step 2: Run the relevant test file and verify failure**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: FAIL because explicit override helper does not exist yet

- [ ] **Step 3: Implement explicit-window resolution while preserving old helper for compatibility**

```ts
export function resolveStaticSiteBuildWindow({
  digestDate,
  windowStartIso,
  windowEndIso,
}: {
  digestDate: string;
  windowStartIso?: string;
  windowEndIso?: string;
}) {
  if (windowStartIso && windowEndIso) {
    return {
      windowStart: new Date(windowStartIso),
      windowEnd: new Date(windowEndIso),
      source: 'explicit' as const,
    };
  }

  const { windowStart, windowEnd } = computeDigestWindowForDate(digestDate);
  return {
    windowStart,
    windowEnd,
    source: 'digest_date' as const,
  };
}
```

Then update build entrypoints to accept environment variables or CLI args carrying `windowStartIso` and `windowEndIso`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/static/exportStaticSiteCli.ts src/cli/buildStaticSite.ts tests/dailyWindow.test.ts
git commit -m "feat: support explicit static publish windows"
```

### Task 3: Move publish flow to checkpoint-owned runtime semantics

**Files:**
- Modify: `src/cli/publishStaticSite.ts`
- Modify: `scripts/publish-static-site.sh`
- Test: targeted publish flow tests if present; otherwise verify with direct command run

- [ ] **Step 1: Write a failing publish-flow test or minimal harness assertion**

If no direct unit test exists, create a small test for a pure helper inside `publishStaticSite.ts` that returns:

```ts
{
  runStartedAt: '2026-06-03T07:00:00.000Z',
  windowStart: '2026-06-02T07:41:00.000Z',
  windowEnd: '2026-06-03T07:00:00.000Z'
}
```

based on a checkpoint timestamp.

- [ ] **Step 2: Run test/harness to verify failure**

Run: targeted `npm test -- <file>` or a one-off `tsx` harness
Expected: FAIL before helper exists

- [ ] **Step 3: Implement publish flow changes**

Required behavior:

- capture `runStartedAt` once at process start
- resolve checkpoint-based window
- log `runStartedAt`, `windowStart`, `windowEnd`, and source
- pass explicit window override into build step
- deploy only after successful build
- write checkpoint only after successful deploy
- keep checkpoint unchanged on failure

Representative helper shape:

```ts
const checkpointPath = resolve(process.cwd(), 'data/state/static-site-publish-checkpoint.json');
const runStartedAt = new Date();
const resolved = resolveStaticSitePublishWindow({ checkpointPath, runStartedAt });
await runBuildSite({
  windowStartIso: resolved.windowStart.toISOString(),
  windowEndIso: resolved.windowEnd.toISOString(),
});
await deployGeneratedSite();
const completedAt = new Date();
writeStaticSitePublishCheckpoint(checkpointPath, {
  lastSuccessfulFetchCompletedAt: completedAt.toISOString(),
  runStartedAt: runStartedAt.toISOString(),
  completedAt: completedAt.toISOString(),
});
```

- [ ] **Step 4: Run end-to-end publish command to verify success**

Run: `bash scripts/publish-static-site.sh`
Expected:
- logs include resolved checkpoint-based window
- build succeeds
- deploy succeeds
- checkpoint file is written/updated only on success

- [ ] **Step 5: Commit**

```bash
git add src/cli/publishStaticSite.ts scripts/publish-static-site.sh data/state/static-site-publish-checkpoint.json
git commit -m "feat: use checkpoint-based static publish windows"
```

### Task 4: Verification sweep

**Files:**
- Modify as needed: any touched source/test files from prior tasks

- [ ] **Step 1: Run focused test suite**

```bash
npm test -- tests/state/staticSitePublishCheckpoint.test.ts tests/dailyWindow.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the full publish flow once**

```bash
bash scripts/publish-static-site.sh
```

Expected:
- checkpoint window logs present
- successful direct deploy to `ai-pulse-scout-static`
- `daily.deanlu.ai` updated

- [ ] **Step 3: Inspect checkpoint file**

```bash
cat data/state/static-site-publish-checkpoint.json
```

Expected: contains latest successful completion timestamp and run metadata

- [ ] **Step 4: Commit any final cleanup**

```bash
git add -A
git commit -m "test: verify checkpoint-based publish flow"
```
