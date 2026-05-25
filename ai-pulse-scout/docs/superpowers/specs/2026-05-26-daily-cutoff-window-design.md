# AI Pulse Scout — Daily Cutoff Window Design

**Date:** 2026-05-26  
**Status:** Draft for review  
**Branch:** `feature/ai-pulse-scout-mvp`

## Goal

Change the normal daily digest window from an exact timestamp-to-timestamp range anchored on `last_successful_run` to a stable local-time daily window.

User requirement:

> I just need a daily update which is not at date time level.

That means the digest should behave like a daily report, not a rolling interval that changes based on the exact second the previous run succeeded.

## Chosen Approach

Use a **fixed 07:00 Asia/Shanghai daily cutoff** for the normal digest job.

Each daily run should cover:
- **window start:** previous local 07:00
- **window end:** current local 07:00

Examples:
- If the job runs at `2026-05-26 07:00 Asia/Shanghai`, the digest window should be:
  - `2026-05-25 07:00 Asia/Shanghai`
  - through `2026-05-26 07:00 Asia/Shanghai`
- If the job runs slightly late, e.g. `2026-05-26 07:12 Asia/Shanghai`, it should still use the same daily cutoff window ending at `2026-05-26 07:00 Asia/Shanghai`, not `07:12`.

## Why This Approach

This matches the scheduler and the user expectation of a once-per-day summary.

It avoids the current failure mode where `last_successful_run` happened at an odd local time (for example, 13:38), causing the next digest to skip valid morning items that belong in the next daily update.

## Scope

This design changes **only the normal daily digest windowing logic**.

It does **not** change:
- source fetching adapters
- digest selection rules
- dedupe behavior
- ledger behavior
- backfill behavior
- scheduler time (`07:00`) unless separately requested

## Functional Design

### 1. New daily window computation

Replace the current daily window calculation for `runDailyDigest()` with a function that computes a stable daily window in Asia/Shanghai.

Inputs:
- current wall-clock time (`now`)
- cutoff hour = `07:00`
- timezone = `Asia/Shanghai`

Behavior:
- determine the most recent cutoff boundary at local `07:00`
- set `windowEnd` to that boundary
- set `windowStart` to `windowEnd - 24 hours`

Rules:
- if `now` is after local `07:00`, use today’s `07:00` as `windowEnd`
- if `now` is before local `07:00`, use yesterday’s `07:00` as `windowEnd`

### 2. Daily digest run behavior

`runDailyDigest()` should:
- compute the fixed daily window
- log the chosen window explicitly
- fetch items published within that window
- continue existing dedupe and rendering flow unchanged

### 3. Run-state behavior

`last_successful_run` should no longer define the daily content window.

It may still be updated after a successful send for operational history and observability, but it should not decide what content belongs in the next daily digest.

### 4. Backfill behavior

Backfill remains unchanged.

Backfill continues using its own backfill window logic and must not adopt the daily cutoff logic.

## Implementation Plan Shape

Expected code changes:
- `src/utils/time.ts`
  - add a helper for stable daily cutoff window calculation
- `src/jobs/runDailyDigest.ts`
  - switch from `computeWindowStart(lastRun, ...)` to the new daily cutoff window helper
- tests
  - add direct tests for:
    - run at 07:00 local
    - run after 07:00 local
    - run before 07:00 local
    - previous successful run at an odd time does not affect content window

## Testing Strategy

We should verify:

1. **Window stability**
   - a run at `07:00`, `07:05`, and `07:20` local all use the same `windowEnd` for that day

2. **Morning-item inclusion**
   - an item published at `2026-05-25 08:00 Asia/Shanghai` is included in the `2026-05-26 07:00` digest

3. **Odd last-run timestamp isolation**
   - a stored `last_successful_run` such as `2026-05-25 13:38 Asia/Shanghai` must not move the daily window start to 13:38

4. **Backfill isolation**
   - backfill behavior remains unchanged

## Risks

### Timezone handling risk

JavaScript `Date` defaults to system behavior, so the implementation must be explicit and deterministic about Asia/Shanghai cutoff handling.

### Slightly late scheduled runs

A run at `07:10` should still represent the daily digest for the `07:00` cutoff, not introduce a moving end time.

This is intentional.

## Non-Goals

This change will not:
- add multi-day missed-run catch-up behavior
- send multiple daily digests automatically after downtime
- widen the daily digest beyond one daily interval
- change source coverage or add more live adapters

## Recommendation

Implement the fixed local `07:00 Asia/Shanghai` cutoff now as the default daily digest policy.

This is the smallest change that matches the real user expectation: a stable daily update rather than timestamp-sensitive rolling coverage.
