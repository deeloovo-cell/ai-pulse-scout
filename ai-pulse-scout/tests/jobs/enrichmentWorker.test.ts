import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializePipelineSchema, openPipelineDb } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, markFetchDone, listItemsForRun } from '../../src/state/itemRepository.js';
import { runEnrichmentWorkerOnce } from '../../src/jobs/enrichmentWorker.js';

describe('enrichmentWorker', () => {
  it('marks a fetched item as ready after enrichment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-enrich-worker-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);
    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T06:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [{
      id: 'item-1', sourceId: 'source-a', url: 'https://example.com/a', title: 'A', publishedAt: null, dedupeKey: 'url:a',
    }]);
    markFetchDone(db, 'item-1', {
      rawContent: '<html>A</html>',
      cleanContent: 'A body',
      fetchMethod: 'test-fetcher',
      durationMs: 12,
      completedAt: '2026-05-30T06:01:00.000Z',
    });

    await runEnrichmentWorkerOnce(db, async () => ({
      summary: 'Summary',
      whyItMatters: 'Why it matters',
      topics: ['AI Infra'],
      relevanceScore: 0.9,
      relevanceBucket: 'high',
      rawResponse: '{}',
      model: 'test-model',
      durationMs: 20,
    }));

    expect((listItemsForRun(db, 'run-1') as Array<Record<string, unknown>>)[0]).toMatchObject({
      enrichment_status: 'done',
      final_status: 'ready',
    });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
