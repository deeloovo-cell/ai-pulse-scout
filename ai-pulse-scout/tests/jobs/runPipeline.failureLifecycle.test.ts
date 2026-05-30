import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { getRunById } from '../../src/state/runRepository.js';
import { listAttemptsForItem } from '../../src/state/itemRepository.js';
import { runPipeline } from '../../src/jobs/runPipeline.js';

describe('runPipeline failure lifecycle', () => {
  it('records failed enrichment attempts and marks run completed without publish when threshold is not met', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-run-failure-'));
    const dbPath = join(dir, 'pipeline.sqlite');

    const result = await runPipeline({
      now: new Date('2026-05-30T07:00:00.000Z'),
      dbPath,
      ingest: async () => ({
        items: [{ id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' }],
      }),
      fetchItem: async () => ({ rawContent: 'A', cleanContent: 'A', fetchMethod: 'test' }),
      enrichItem: async () => {
        throw new Error('llm exploded');
      },
      render: () => '<html>digest</html>',
      publish: async () => undefined,
    });

    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);

    expect(result.publishable).toBe(false);
    expect(getRunById(db, 'run-2026-05-30T07:00:00.000Z')).toMatchObject({
      status: 'completed_not_published',
      completed_at: expect.any(String),
    });
    expect(listAttemptsForItem(db, '1')).toMatchObject([
      {
        stage: 'fetch',
        outcome: 'succeeded',
      },
      {
        stage: 'enrichment',
        outcome: 'failed',
        error_message: 'llm exploded',
      },
    ]);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
