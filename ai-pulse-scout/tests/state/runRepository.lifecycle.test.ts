import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { createRun, getRunById, markRunPublished, markRunReadyForProcessing, updateRunCounters } from '../../src/state/runRepository.js';

describe('runRepository lifecycle', () => {
  it('marks a run published with completion timestamps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-run-lifecycle-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T07:00:00.000Z' });
    markRunReadyForProcessing(db, 'run-1', '2026-05-30T07:01:00.000Z');
    updateRunCounters(db, 'run-1', {
      totalItems: 2,
      terminalItems: 2,
      successfulItems: 1,
      failedItems: 1,
      deferredItems: 1,
    });
    markRunPublished(db, 'run-1', '2026-05-30T07:02:00.000Z');

    expect(getRunById(db, 'run-1')).toMatchObject({
      status: 'published',
      published_at: '2026-05-30T07:02:00.000Z',
      completed_at: '2026-05-30T07:02:00.000Z',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
