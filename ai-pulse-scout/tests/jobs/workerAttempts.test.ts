import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { createRun } from '../../src/state/runRepository.js';
import { insertDiscoveredItems, listAttemptsForItem, markFetchDone } from '../../src/state/itemRepository.js';
import { runFetchWorkerOnce } from '../../src/jobs/fetchWorker.js';
import { runEnrichmentWorkerOnce } from '../../src/jobs/enrichmentWorker.js';

describe('worker attempt recording', () => {
  it('records fetch and enrichment attempts for a successful pipeline item', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-worker-attempts-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    createRun(db, { id: 'run-1', windowDate: '2026-05-30', startedAt: '2026-05-30T07:00:00.000Z' });
    insertDiscoveredItems(db, 'run-1', [
      { id: 'item-1', sourceId: 'source-1', url: 'https://example.com/1', title: 'Item 1', publishedAt: null, dedupeKey: 'dedupe-1' },
    ]);

    await runFetchWorkerOnce(db, async () => ({ rawContent: 'raw', cleanContent: 'clean', fetchMethod: 'test' }));
    await runEnrichmentWorkerOnce(db, async () => ({
      summary: 'Summary',
      whyItMatters: 'Why',
      topics: ['AI News Roundup'],
      relevanceScore: 0.9,
      relevanceBucket: 'high',
      rawResponse: '{}',
      model: 'test-model',
      durationMs: 12,
    }));

    expect(listAttemptsForItem(db, 'item-1')).toHaveLength(2);
    expect(listAttemptsForItem(db, 'item-1')).toMatchObject([
      { stage: 'fetch', outcome: 'succeeded' },
      { stage: 'enrichment', outcome: 'succeeded' },
    ]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
