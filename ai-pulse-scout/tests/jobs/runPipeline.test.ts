import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runPipeline } from '../../src/jobs/runPipeline.js';

describe('runPipeline', () => {
  it('publishes when failed items stay within the 50 percent threshold', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-pipeline-'));
    const render = vi.fn(() => '<html>digest</html>');
    const publish = vi.fn(async () => undefined);

    const result = await runPipeline({
      now: new Date('2026-05-30T07:00:00.000Z'),
      dbPath: join(dir, 'pipeline.sqlite'),
      ingest: async () => ({
        items: [
          { id: '1', sourceId: 'a', url: 'https://a', title: 'A', publishedAt: null, dedupeKey: 'a' },
          { id: '2', sourceId: 'b', url: 'https://b', title: 'B', publishedAt: null, dedupeKey: 'b' },
        ],
      }),
      fetchItem: async (item) => ({ rawContent: item.title, cleanContent: item.title, fetchMethod: 'test' }),
      enrichItem: async (item) => {
        if (item.id === '2') throw new Error('boom');
        return {
          summary: 'Summary',
          whyItMatters: 'Why',
          topics: ['AI Infra'],
          relevanceScore: 0.9,
          relevanceBucket: 'high',
          rawResponse: '{}',
          model: 'test-model',
          durationMs: 10,
        };
      },
      render,
      publish,
    });

    expect(result.publishable).toBe(true);
    expect(result.failedItems).toBe(1);
    expect(result.deferredItems).toBe(1);
    expect(render).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();

    rmSync(dir, { recursive: true, force: true });
  });
});
