import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readStaticSitePublishCheckpoint,
  resolveStaticSitePublishWindow,
  writeStaticSitePublishCheckpoint,
} from '../../src/state/staticSitePublishCheckpoint.js';

describe('staticSitePublishCheckpoint', () => {
  it('uses previous successful completion as window start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');
    writeStaticSitePublishCheckpoint(checkpointPath, {
      lastSuccessfulFetchCompletedAt: '2026-06-01T07:32:18.000Z',
      runStartedAt: '2026-06-02T07:00:00.000Z',
      completedAt: '2026-06-02T07:41:00.000Z',
    });

    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-01T07:32:18.000Z');
    expect(resolved.windowEnd.toISOString()).toBe('2026-06-03T07:00:00.000Z');
    expect(resolved.source).toBe('checkpoint');
  });

  it('falls back to 24h before run start when checkpoint is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'missing.json');
    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    expect(resolved.windowEnd.toISOString()).toBe('2026-06-03T07:00:00.000Z');
    expect(resolved.source).toBe('fallback_24h');
  });

  it('falls back to 24h before run start when checkpoint is malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');
    writeFileSync(checkpointPath, '{"lastSuccessfulFetchCompletedAt":"nope"}', 'utf8');

    const resolved = resolveStaticSitePublishWindow({
      checkpointPath,
      runStartedAt: new Date('2026-06-03T07:00:00.000Z'),
    });

    expect(resolved.windowStart.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    expect(resolved.source).toBe('fallback_24h');
  });

  it('writes checkpoint payload after success', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aps-checkpoint-'));
    const checkpointPath = join(dir, 'checkpoint.json');

    writeStaticSitePublishCheckpoint(checkpointPath, {
      lastSuccessfulFetchCompletedAt: '2026-06-03T07:41:00.000Z',
      runStartedAt: '2026-06-03T07:00:00.000Z',
      completedAt: '2026-06-03T07:41:00.000Z',
    });

    const raw = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    expect(raw.lastSuccessfulFetchCompletedAt).toBe('2026-06-03T07:41:00.000Z');
    expect(readStaticSitePublishCheckpoint(checkpointPath)?.lastSuccessfulFetchCompletedAt).toBe('2026-06-03T07:41:00.000Z');
  });
});
