import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import {
  insertDiscoveredItems,
  claimNextFetchItem,
  markFetchDone,
  markEnrichmentFailed,
  markDeferredForRetry,
  listItemsForRun,
} from '../../src/state/itemRepository.js';

describe('itemRepository', () => {
  it('supports claim and state transitions for pipeline items', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-items-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });

    insertDiscoveredItems(db, 'run-1', [
      {
        id: 'item-1',
        sourceId: 'source-a',
        url: 'https://example.com/a',
        title: 'A',
        publishedAt: '2026-05-30T05:00:00.000Z',
        dedupeKey: 'url:https://example.com/a',
      },
    ]);

    const claimed = claimNextFetchItem(db);
    expect((claimed as { id: string } | null)?.id).toBe('item-1');

    markFetchDone(db, 'item-1', {
      rawContent: '<html>A</html>',
      cleanContent: 'A',
      fetchMethod: 'http',
      durationMs: 100,
      completedAt: '2026-05-30T06:01:00.000Z',
    });
    markEnrichmentFailed(db, 'item-1');
    markDeferredForRetry(db, 'item-1', 'run-2');

    expect((listItemsForRun(db, 'run-1') as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'item-1',
      content_status: 'done',
      final_status: 'deferred_for_retry',
      carry_forward_run_id: 'run-2',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
