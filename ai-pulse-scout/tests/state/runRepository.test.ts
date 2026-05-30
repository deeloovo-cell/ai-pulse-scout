import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun, getRunById, markRunReadyForProcessing, updateRunCounters } from '../../src/state/runRepository.js';

describe('runRepository', () => {
  it('creates and updates a run record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-run-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    createRun(db, {
      id: 'run-1',
      windowDate: '2026-05-30',
      startedAt: '2026-05-30T06:00:00.000Z',
    });
    markRunReadyForProcessing(db, 'run-1', '2026-05-30T06:01:00.000Z');
    updateRunCounters(db, 'run-1', {
      totalItems: 10,
      successfulItems: 6,
      failedItems: 2,
      deferredItems: 1,
      terminalItems: 9,
    });

    expect(getRunById(db, 'run-1')).toMatchObject({
      id: 'run-1',
      status: 'ready_for_processing',
      total_items: 10,
      successful_items: 6,
      failed_items: 2,
      deferred_items: 1,
      terminal_items: 9,
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
