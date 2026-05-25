import { format, subHours, subDays } from 'date-fns';

const SHANGHAI_OFFSET_HOURS = 8;
const DAILY_CUTOFF_HOUR = 7;
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

export function computeDailyCutoffWindow(now: Date): DailyCutoffWindow {
  const localMs = now.getTime() + SHANGHAI_OFFSET_HOURS * 3600_000;
  const localNow = new Date(localMs);

  const localYear = localNow.getUTCFullYear();
  const localMonth = localNow.getUTCMonth();
  const localDate = localNow.getUTCDate();
  const localHour = localNow.getUTCHours();

  const cutoffDay = localHour >= DAILY_CUTOFF_HOUR ? localDate : localDate - 1;
  const windowEnd = new Date(
    Date.UTC(localYear, localMonth, cutoffDay, DAILY_CUTOFF_HOUR - SHANGHAI_OFFSET_HOURS, 0, 0, 0),
  );
  const windowStart = new Date(windowEnd.getTime() - ONE_DAY_HOURS * 3600_000);

  return { windowStart, windowEnd };
}

export function computeBackfillWindowStart(days: number): Date {
  return subDays(new Date(), days);
}

export function isWithinWindow(publishedAt: Date | null, windowStart: Date, now: Date): boolean {
  if (!publishedAt) return false;
  return publishedAt >= windowStart && publishedAt <= now;
}
