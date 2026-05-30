import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { getRunById } from '../../src/state/runRepository.js';
import { runPipeline } from '../../src/jobs/runPipeline.js';

describe('runPipeline lifecycle', () => {
  it('marks the run published when the threshold allows delivery', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-run-published-'));
    const dbPath = join(dir, 'pipeline.sqlite');

    await runPipeline({
      now: new Date('2026-05-30T07:00:00.000Z'),
      dbPath,
      ingest: async () => ({
        items: [{ id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' }],
      }),
      fetchItem: async () => ({ rawContent: 'A', cleanContent: 'A', fetchMethod: 'test' }),
      enrichItem: async () => ({
        summary: 'Summary',
        whyItMatters: 'Why',
        topics: ['AI News Roundup'],
        relevanceScore: 0.9,
        relevanceBucket: 'high',
        rawResponse: '{}',
        model: 'test-model',
        durationMs: 10,
      }),
      render: () => '<html>digest</html>',
      publish: async () => undefined,
    });

    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);
    expect(getRunById(db, 'run-2026-05-30T07:00:00.000Z')).toMatchObject({ status: 'published' });

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
