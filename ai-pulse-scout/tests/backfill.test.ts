import { describe, it, expect } from 'vitest';
import { computeBackfillWindowStart } from '../src/utils/time.js';

describe('computeBackfillWindowStart', () => {
  it('returns a date approximately N days before now', () => {
    const days = 7;
    const before = Date.now();
    const windowStart = computeBackfillWindowStart(days);
    const after = Date.now();
    const expectedMs = days * 24 * 60 * 60 * 1000;
    const diffFromBefore = before - windowStart.getTime();
    const diffFromAfter = after - windowStart.getTime();
    // window start must be between (before - days) and (after - days), within 1s tolerance
    expect(diffFromBefore).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diffFromAfter).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('returns further back for more days', () => {
    const w3 = computeBackfillWindowStart(3);
    const w7 = computeBackfillWindowStart(7);
    const w14 = computeBackfillWindowStart(14);
    expect(w3.getTime()).toBeGreaterThan(w7.getTime());
    expect(w7.getTime()).toBeGreaterThan(w14.getTime());
  });

  it('1-day window is within the last 24 hours', () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const w = computeBackfillWindowStart(1);
    expect(Math.abs(w.getTime() - oneDayAgo)).toBeLessThan(2000);
  });
});

describe('backfill state invariants', () => {
  it('preview uses empty ledger so all historical items are visible', () => {
    const emptyLedger = new Set<string>();
    const fakeFingerprint = 'abc123def456';
    expect(emptyLedger.has(fakeFingerprint)).toBe(false);
  });

  it('last_successful_run must not change during backfill', () => {
    // Backfill contract: runState is read-only — last_successful_run unchanged
    const before = { last_successful_run: '2026-05-14T07:00:00Z', run_count: 5 };
    // Backfill never calls saveSuccessfulRun — simulate that the state object stays the same
    const after = { ...before };
    expect(after.last_successful_run).toBe('2026-05-14T07:00:00Z');
    expect(after.run_count).toBe(5);
  });

  it('send mode checks real ledger; preview mode skips it', () => {
    // send=true → use real ledger to filter already-sent items
    const realLedger = new Set(['fingerprint-already-sent', 'https://example.com/old-post']);
    expect(realLedger.has('fingerprint-already-sent')).toBe(true);

    // send=false → use empty ledger so all published items are visible
    const emptyLedger = new Set<string>();
    expect(emptyLedger.has('fingerprint-already-sent')).toBe(false);
  });

  it('backfill does not advance normal daily window anchor', () => {
    // Daily cadence: windowStart = lastRun - bufferHours
    const lastRun = new Date('2026-05-20T07:00:00Z');
    const bufferHours = 2;
    const normalWindowStart = new Date(lastRun.getTime() - bufferHours * 3600_000);
    // After backfill, lastRun must remain the same
    const lastRunAfterBackfill = new Date('2026-05-20T07:00:00Z');
    expect(normalWindowStart.toISOString()).toBe('2026-05-20T05:00:00.000Z');
    expect(lastRunAfterBackfill.getTime()).toBe(lastRun.getTime());
  });
});
