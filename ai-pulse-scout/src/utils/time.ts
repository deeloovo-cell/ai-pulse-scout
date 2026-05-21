import { format, subHours, subDays } from 'date-fns';

export function formatDigestDate(date: Date): string {
  return format(date, 'MM-dd-yyyy');
}

export function computeWindowStart(lastRun: Date | null, windowHours: number, bufferHours: number): Date {
  const anchor = lastRun ?? subHours(new Date(), windowHours);
  return subHours(anchor, bufferHours);
}

export function computeBackfillWindowStart(days: number): Date {
  return subDays(new Date(), days);
}

export function isWithinWindow(publishedAt: Date | null, windowStart: Date, now: Date): boolean {
  if (!publishedAt) return true; // unknown publish time: include (ledger dedupes repeats)
  return publishedAt >= windowStart && publishedAt <= now;
}
