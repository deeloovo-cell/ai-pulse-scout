import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, listItemsForRun } from '../../src/state/itemRepository.js';
import { runFetchWorkerOnce } from '../../src/jobs/fetchWorker.js';

describe('fetchWorker', () => {
  it('claims one pending item and stores fetched content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-fetch-worker-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [{
      id: 'item-1', sourceId: 'source-a', url: 'https://example.com/a', title: 'A', publishedAt: null, dedupeKey: 'url:a',
    }]);

    await runFetchWorkerOnce(db, async () => ({
      rawContent: '<html>A</html>',
      cleanContent: 'A body',
      fetchMethod: 'test-fetcher',
    }));

    expect((listItemsForRun(db, 'run-1') as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'item-1',
      content_status: 'done',
      enrichment_status: 'pending',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
