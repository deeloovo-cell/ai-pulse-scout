import { join } from 'node:path';

const SHANGHAI_OFFSET_HOURS = 8;
const DAILY_CUTOFF_HOUR = 7;

function formatDateFromShanghaiLocal(localYear: number, localMonth: number, localDate: number): string {
  const month = String(localMonth + 1).padStart(2, '0');
  const day = String(localDate).padStart(2, '0');
  return `${localYear}-${month}-${day}`;
}

export function computeDigestWindowForDate(targetDate: string): { windowStart: Date; windowEnd: Date } {
  const [year, month, day] = targetDate.split('-').map((value) => Number.parseInt(value, 10));
  const windowEnd = new Date(Date.UTC(year, month - 1, day, DAILY_CUTOFF_HOUR - SHANGHAI_OFFSET_HOURS, 0, 0, 0));
  const windowStart = new Date(windowEnd.getTime() - 24 * 3600_000);
  return { windowStart, windowEnd };
}

export function computeAutoDeployDigestDate(now: Date = new Date()): string {
  const localMs = now.getTime() + SHANGHAI_OFFSET_HOURS * 3600_000;
  const localNow = new Date(localMs);

  const localYear = localNow.getUTCFullYear();
  const localMonth = localNow.getUTCMonth();
  const localDate = localNow.getUTCDate();
  const localHour = localNow.getUTCHours();

  const digestDate = localHour >= DAILY_CUTOFF_HOUR ? localDate : localDate - 1;
  const digestDateUtc = new Date(Date.UTC(localYear, localMonth, digestDate, 0, 0, 0, 0));

  return formatDateFromShanghaiLocal(
    digestDateUtc.getUTCFullYear(),
    digestDateUtc.getUTCMonth(),
    digestDateUtc.getUTCDate(),
  );
}

export function defaultStaticSiteOutputDir(): string {
  return join(process.cwd(), 'data/output/site');
}
