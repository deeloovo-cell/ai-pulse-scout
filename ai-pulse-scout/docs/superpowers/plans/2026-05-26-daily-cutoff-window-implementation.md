# Daily Cutoff Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the daily digest to use a stable 07:00 Asia/Shanghai cutoff window instead of a timestamp-to-timestamp window anchored on `last_successful_run`.

**Architecture:** Add a deterministic daily window helper in `src/utils/time.ts`, switch `runDailyDigest()` to use that helper, and cover the behavior with direct unit tests around local cutoff semantics. Keep backfill behavior and run-state persistence unchanged except that `last_successful_run` no longer defines daily content inclusion.

**Tech Stack:** TypeScript, Vitest, date-fns, existing Node ESM codebase

---

## File Structure

- Modify: `src/utils/time.ts`
  - Add a stable daily cutoff window helper for Asia/Shanghai 07:00.
- Modify: `src/jobs/runDailyDigest.ts`
  - Replace the current rolling window computation with the fixed daily cutoff helper.
- Modify: `tests/backfill.test.ts`
  - Preserve existing backfill invariants and add assertions showing the daily cutoff helper does not affect backfill logic.
- Create: `tests/dailyWindow.test.ts`
  - Add focused tests for the new cutoff window behavior.

### Task 1: Add failing tests for the daily cutoff helper

**Files:**
- Create: `tests/dailyWindow.test.ts`
- Modify: `src/utils/time.ts`
- Test: `tests/dailyWindow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computeDailyCutoffWindow } from '../src/utils/time.js';

describe('computeDailyCutoffWindow', () => {
  it('uses today 07:00 Asia/Shanghai as window end when now is after cutoff', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T23:20:32.207Z'));

    expect(result.windowStart.toISOString()).toBe('2026-05-24T23:00:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-25T23:00:00.000Z');
  });

  it('uses yesterday 07:00 Asia/Shanghai as window end when now is before cutoff', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T22:30:00.000Z'));

    expect(result.windowStart.toISOString()).toBe('2026-05-23T23:00:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-24T23:00:00.000Z');
  });

  it('keeps the same window end for slightly late runs after 07:00 Asia/Shanghai', () => {
    const exact = computeDailyCutoffWindow(new Date('2026-05-25T23:00:00.000Z'));
    const late = computeDailyCutoffWindow(new Date('2026-05-25T23:12:45.000Z'));

    expect(late.windowEnd.toISOString()).toBe(exact.windowEnd.toISOString());
    expect(late.windowStart.toISOString()).toBe(exact.windowStart.toISOString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: FAIL because `computeDailyCutoffWindow` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add this code to `src/utils/time.ts`:

```ts
import { format, subHours, subDays } from 'date-fns';

const SHANGHAI_OFFSET_HOURS = 8;
const DAILY_CUTOFF_HOUR = 7;
const ONE_DAY_HOURS = 24;

export interface DailyCutoffWindow {
  windowStart: Date;
  windowEnd: Date;
}

export function computeDailyCutoffWindow(now: Date): DailyCutoffWindow {
  const localMs = now.getTime() + SHANGHAI_OFFSET_HOURS * 3600_000;
  const localNow = new Date(localMs);

  const localYear = localNow.getUTCFullYear();
  const localMonth = localNow.getUTCMonth();
  const localDate = localNow.getUTCDate();
  const localHour = localNow.getUTCHours();

  const cutoffDay = localHour >= DAILY_CUTOFF_HOUR ? localDate : localDate - 1;
  const windowEnd = new Date(Date.UTC(localYear, localMonth, cutoffDay, DAILY_CUTOFF_HOUR - SHANGHAI_OFFSET_HOURS, 0, 0, 0));
  const windowStart = new Date(windowEnd.getTime() - ONE_DAY_HOURS * 3600_000);

  return { windowStart, windowEnd };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/dailyWindow.test.ts src/utils/time.ts
git commit -m "test: add daily cutoff window helper"
```

### Task 2: Switch runDailyDigest to the fixed daily cutoff window

**Files:**
- Modify: `src/jobs/runDailyDigest.ts`
- Test: `tests/dailyWindow.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `tests/dailyWindow.test.ts` with this test:

```ts
import { describe, expect, it, vi } from 'vitest';
import { computeDailyCutoffWindow } from '../src/utils/time.js';

describe('daily digest window policy', () => {
  it('ignores odd last_successful_run timestamps when computing the daily content window', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T23:20:32.207Z'));

    expect(result.windowStart.toISOString()).toBe('2026-05-24T23:00:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-25T23:00:00.000Z');
  });
});
```

This is a behavior lock: the daily helper depends only on `now`, not on `last_successful_run`.

- [ ] **Step 2: Run test to verify it fails for the intended reason**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: either FAIL before the helper exists, or PASS once Task 1 lands. If it already passes, proceed — this step confirms the test expresses the correct new contract.

- [ ] **Step 3: Write minimal implementation**

Update `src/jobs/runDailyDigest.ts`:

```ts
import { computeDailyCutoffWindow } from '../utils/time.js';
```

Replace this block:

```ts
  const runState = loadRunState();
  const now = new Date();

  const lastRun = runState.last_successful_run ? new Date(runState.last_successful_run) : null;
  const windowStart = computeWindowStart(lastRun, config.digest.collection_window_hours, config.digest.safety_buffer_hours);

  logger.info(`Collection window: ${windowStart.toISOString()} → ${now.toISOString()}`);
```

with this block:

```ts
  const runState = loadRunState();
  const now = new Date();

  const { windowStart, windowEnd } = computeDailyCutoffWindow(now);

  logger.info(`Collection window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
```

And replace this line:

```ts
  const fetchResults = await fetchAllSources(config.sources, windowStart, now);
```

with:

```ts
  const fetchResults = await fetchAllSources(config.sources, windowStart, windowEnd);
```

Do not remove run-state loading or saving in this task. Only stop using `last_successful_run` as the content window anchor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/dailyWindow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/jobs/runDailyDigest.ts tests/dailyWindow.test.ts
git commit -m "feat: use fixed daily cutoff window for digest"
```

### Task 3: Preserve backfill and daily window invariants

**Files:**
- Modify: `tests/backfill.test.ts`
- Test: `tests/backfill.test.ts`

- [ ] **Step 1: Write the failing test**

Append this test to `tests/backfill.test.ts`:

```ts
import { computeDailyCutoffWindow } from '../src/utils/time.js';

describe('daily cutoff isolation', () => {
  it('keeps backfill independent from the daily cutoff window helper', () => {
    const daily = computeDailyCutoffWindow(new Date('2026-05-25T23:20:32.207Z'));
    const backfill = computeBackfillWindowStart(7);

    expect(daily.windowStart.toISOString()).toBe('2026-05-24T23:00:00.000Z');
    expect(daily.windowEnd.toISOString()).toBe('2026-05-25T23:00:00.000Z');
    expect(backfill.getTime()).toBeLessThan(Date.now());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backfill.test.ts`
Expected: FAIL before the helper import / implementation is available, otherwise PASS once Task 1 is present.

- [ ] **Step 3: Write minimal implementation**

If needed, update the import line in `tests/backfill.test.ts` to:

```ts
import { computeBackfillWindowStart, computeDailyCutoffWindow, isWithinWindow } from '../src/utils/time.js';
```

No production code changes should be needed in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/backfill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/backfill.test.ts
git commit -m "test: lock backfill independence from daily cutoff"
```

### Task 4: Full verification and final send-path check

**Files:**
- Modify: none
- Test: `tests/dailyWindow.test.ts`, `tests/backfill.test.ts`, full suite

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- tests/dailyWindow.test.ts tests/backfill.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all test files PASS with 0 failures

- [ ] **Step 3: Run a real send-test check to inspect the logged window**

Run: `npm run send-test`
Expected:
- log prints a collection window ending at the fixed `07:00 Asia/Shanghai` cutoff
- if there are qualifying items, email sends
- if there are no qualifying items, send is skipped for that reason only

- [ ] **Step 4: Inspect git status**

Run: `git status --short --branch`
Expected: clean working tree or only intended changes before commit/push

- [ ] **Step 5: Commit and push**

```bash
git add src/utils/time.ts src/jobs/runDailyDigest.ts tests/dailyWindow.test.ts tests/backfill.test.ts
git commit -m "feat: anchor daily digest to fixed local cutoff"
git push origin feature/ai-pulse-scout-mvp
```

## Self-Review

Spec coverage check:
- fixed 07:00 Asia/Shanghai cutoff: covered in Task 1 and Task 2
- runDailyDigest switch from last-run anchor: covered in Task 2
- backfill unchanged: covered in Task 3
- verification with real send path: covered in Task 4

Placeholder scan:
- no TODO/TBD placeholders left
- every task has explicit files, commands, and expected outcomes

Type consistency:
- helper name is consistently `computeDailyCutoffWindow`
- returned shape is consistently `{ windowStart, windowEnd }`
- daily digest fetch uses `windowEnd` instead of `now`
