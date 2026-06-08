import { format, subHours, subDays } from 'date-fns';

const ONE_DAY_HOURS = 24;

export interface DailyCutoffWindow {
  windowStart: Date;
  windowEnd: Date;
}

export function formatDigestDate(date: Date): string {
  return format(date, 'MM-dd-yyyy');
}

export function computeWindowStart(lastRun: Date | null, windowHours: number, bufferHours: number): Date {
  const anchor = lastRun ?? subHours(new Date(), windowHours);
  return subHours(anchor, bufferHours);
}

/**
 * Computes a rolling 24-hour collection window ending at `now`.
 *
 * Previously this used a fixed 07:00 Shanghai cutoff, which caused two bugs:
 *   1. Items published after 07:00 on run day were silently excluded.
 *   2. Any run outside the exact daily cadence would miss content.
 *
 * Now the window is always [now - 24h, now], optionally extended by
 * `safetyBufferHours` on the start side to avoid gaps on retries.
 */
export function computeDailyCutoffWindow(now: Date, safetyBufferHours = 0): DailyCutoffWindow {
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - (ONE_DAY_HOURS + safetyBufferHours) * 3600_000);
  return { windowStart, windowEnd };
}

export function computeBackfillWindowStart(days: number): Date {
  return subDays(new Date(), days);
}

export function isWithinWindow(publishedAt: Date | null, windowStart: Date, now: Date): boolean {
  if (!publishedAt) return false;
  return publishedAt >= windowStart && publishedAt <= now;
}
