import { describe, expect, it } from 'vitest';
import { computeDailyCutoffWindow } from '../src/utils/time.js';

describe('computeDailyCutoffWindow', () => {
  it('uses today 07:00 Asia/Shanghai as window end when now is after cutoff', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T23:20:32.207Z'));

    expect(result.windowStart.toISOString()).toBe('2026-05-24T23:20:32.207Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-25T23:20:32.207Z');
  });

  it('uses yesterday 07:00 Asia/Shanghai as window end when now is before cutoff', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T22:30:00.000Z'));

    expect(result.windowStart.toISOString()).toBe('2026-05-24T22:30:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-25T22:30:00.000Z');
  });

  it('keeps the same window end for slightly late runs after 07:00 Asia/Shanghai', () => {
    const exact = computeDailyCutoffWindow(new Date('2026-05-25T23:00:00.000Z'));
    const late = computeDailyCutoffWindow(new Date('2026-05-25T23:12:45.000Z'));

    expect(late.windowEnd.getTime() - exact.windowEnd.getTime()).toBe(12 * 60 * 1000 + 45000);
  });

  it('ignores odd last_successful_run timestamps when computing the daily content window', () => {
    const result = computeDailyCutoffWindow(new Date('2026-05-25T23:20:32.207Z'), 2);

    expect(result.windowStart.toISOString()).toBe('2026-05-24T21:20:32.207Z');
    expect(result.windowEnd.toISOString()).toBe('2026-05-25T23:20:32.207Z');
  });
});
