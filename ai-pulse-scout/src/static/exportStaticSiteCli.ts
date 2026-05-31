import { join } from 'node:path';

const SHANGHAI_OFFSET_HOURS = 8;
const DAILY_CUTOFF_HOUR = 7;

export function computeDigestWindowForDate(targetDate: string): { windowStart: Date; windowEnd: Date } {
  const [year, month, day] = targetDate.split('-').map((value) => Number.parseInt(value, 10));
  const windowEnd = new Date(Date.UTC(year, month - 1, day, DAILY_CUTOFF_HOUR - SHANGHAI_OFFSET_HOURS, 0, 0, 0));
  const windowStart = new Date(windowEnd.getTime() - 24 * 3600_000);
  return { windowStart, windowEnd };
}

export function defaultStaticSiteOutputDir(): string {
  return join(process.cwd(), 'data/output/site');
}
