import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { computeDailyCutoffWindow } from '../utils/time.js';

export interface StaticSitePublishCheckpoint {
  lastSuccessfulFetchCompletedAt: string;
  runStartedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export function readStaticSitePublishCheckpoint(path: string): StaticSitePublishCheckpoint | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as StaticSitePublishCheckpoint;
    const timestamp = parsed.lastSuccessfulFetchCompletedAt;
    if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveStaticSitePublishWindow({
  checkpointPath,
  runStartedAt,
}: {
  checkpointPath: string;
  runStartedAt: Date;
}): {
  windowStart: Date;
  windowEnd: Date;
  source: 'daily_cutoff' | 'fallback_24h';
} {
  const checkpoint = readStaticSitePublishCheckpoint(checkpointPath);

  if (checkpoint) {
    const dailyWindow = computeDailyCutoffWindow(runStartedAt);
    return {
      windowStart: dailyWindow.windowStart,
      windowEnd: dailyWindow.windowEnd,
      source: 'daily_cutoff',
    };
  }

  return {
    windowStart: new Date(runStartedAt.getTime() - 24 * 60 * 60 * 1000),
    windowEnd: runStartedAt,
    source: 'fallback_24h',
  };
}

export function writeStaticSitePublishCheckpoint(path: string, checkpoint: StaticSitePublishCheckpoint): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: StaticSitePublishCheckpoint = {
    ...checkpoint,
    updatedAt: checkpoint.completedAt ?? checkpoint.lastSuccessfulFetchCompletedAt,
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
