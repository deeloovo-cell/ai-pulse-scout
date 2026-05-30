import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, listAttemptsForItem, recordAttempt } from '../../src/state/itemRepository.js';

describe('item attempt records', () => {
  it('records stage attempts against the latest run item key while keeping business item id stable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-item-attempts-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T07:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [
      { id: 'item-1', sourceId: 'source-1', url: 'https://example.com/1', title: 'Item 1', publishedAt: null, dedupeKey: 'dedupe-1' },
    ]);

    recordAttempt(db, 'item-1', {
      stage: 'fetch',
      attemptNumber: 1,
      startedAt: '2026-05-30T07:00:01.000Z',
      completedAt: '2026-05-30T07:00:02.000Z',
      durationMs: 1000,
      outcome: 'succeeded',
      errorMessage: null,
    });

    expect(listAttemptsForItem(db, 'item-1')).toMatchObject([
      {
        stage: 'fetch',
        attempt_number: 1,
        outcome: 'succeeded',
      },
    ]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
