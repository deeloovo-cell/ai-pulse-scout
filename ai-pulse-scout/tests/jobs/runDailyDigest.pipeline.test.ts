import { describe, expect, it, vi } from 'vitest';
import type { NormalizedItem } from '../../src/types/item.js';

const runPipelineMock = vi.fn();

vi.mock('../../src/jobs/runPipeline.js', () => ({
  runPipeline: (...args: unknown[]) => runPipelineMock(...args),
}));

function makeItem(id: string, title: string): NormalizedItem {
  return {
    id,
    title,
    source_name: 'Source',
    source_category: 'webpage',
    source_url: 'https://example.com',
    item_url: `https://example.com/${id}`,
    published_at: new Date('2026-05-30T00:00:00.000Z'),
    fetched_at: new Date('2026-05-30T00:00:00.000Z'),
    author: '',
    content_text: 'Body',
    summary: 'Summary',
    tags: [],
    content_type: 'article',
    fingerprint: id,
    relevance_scores: { ai_engineering: 0, industrial_ai: 0, cad_cae_cam: 0, executive_signal: 0, aac_relevance: 0, overall: 0 },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
  } as any;
}

describe('runDailyDigest pipeline integration', () => {
  it('delegates orchestration to runPipeline and returns digest-shaped results', async () => {
    runPipelineMock.mockResolvedValueOnce({
      publishable: true,
      failedItems: 1,
      totalItems: 2,
      deferredItems: 1,
      subject: 'AI Digest',
      html: '<html>digest</html>',
      items: [makeItem('1', 'A')],
      outputPath: '/tmp/digest.html',
    });

    const { runDailyDigest } = await import('../../src/jobs/runDailyDigest.js');
    const result = await runDailyDigest(null, false);

    expect(runPipelineMock).toHaveBeenCalledOnce();
    expect(result.subject).toBe('AI Digest');
    expect(result.itemCount).toBe(1);
    expect(result.totalFetched).toBe(2);
    expect(result.outputPath).toBe('/tmp/digest.html');
  });
});
