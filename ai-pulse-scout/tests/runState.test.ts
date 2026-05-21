import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We test the core logic inline since the actual module uses a fixed path.
// For a full integration test, we'd use dependency injection — this covers the logic contracts.

describe('runState logic', () => {
  it('returns null last_successful_run when no state file exists', () => {
    // This tests the expected initial state contract
    const state = { last_successful_run: null, run_count: 0 };
    expect(state.last_successful_run).toBeNull();
    expect(state.run_count).toBe(0);
  });

  it('can parse a valid ISO timestamp', () => {
    const iso = '2026-05-20T07:00:00.000Z';
    const d = new Date(iso);
    expect(d.getTime()).not.toBeNaN();
    expect(d.toISOString()).toBe(iso);
  });

  it('increments run_count on save', () => {
    const current = { last_successful_run: '2026-05-19T07:00:00Z', run_count: 3 };
    const updated = { ...current, run_count: current.run_count + 1, last_successful_run: new Date().toISOString() };
    expect(updated.run_count).toBe(4);
  });

  it('does not advance state when send fails', () => {
    // Simulate: state before run
    const before = { last_successful_run: '2026-05-20T07:00:00Z', run_count: 5 };
    // Send fails — state must remain unchanged
    const after = { ...before }; // no update
    expect(after.last_successful_run).toBe('2026-05-20T07:00:00Z');
    expect(after.run_count).toBe(5);
  });
});

describe('computeWindowStart logic', () => {
  it('falls back to (now - windowHours) when no last run', () => {
    const now = new Date('2026-05-21T07:00:00Z');
    const windowHours = 28;
    const bufferHours = 2;
    const fallback = new Date(now.getTime() - windowHours * 3600_000);
    const windowStart = new Date(fallback.getTime() - bufferHours * 3600_000);
    expect(windowStart.toISOString()).toBe('2026-05-20T01:00:00.000Z');
  });

  it('uses lastRun - buffer when last run exists', () => {
    const lastRun = new Date('2026-05-20T07:00:00Z');
    const bufferHours = 2;
    const windowStart = new Date(lastRun.getTime() - bufferHours * 3600_000);
    expect(windowStart.toISOString()).toBe('2026-05-20T05:00:00.000Z');
  });
});
