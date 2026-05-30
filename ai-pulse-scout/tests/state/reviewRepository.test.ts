import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { listReviewItemsWindow, saveDigestReviewItems, upsertItemReview } from '../../src/state/reviewRepository.js';

describe('reviewRepository', () => {
  it('stores digest review snapshots and single-user review state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        {
          itemKey: 'item-1',
          publishedAt: '2026-05-29T10:00:00.000Z',
          title: 'Alpha item',
          excerpt: 'Alpha excerpt',
          itemUrl: 'https://example.com/a',
          sourceName: 'Example',
          topicTags: ['AI'],
          matchScore: 0.92,
          normalizedItemJson: '{"id":"item-1"}',
        },
      ],
    });

    upsertItemReview(db, { itemKey: 'item-1', rating: 4, followUp: true });

    const items = listReviewItemsWindow(db, {
      startDigestDate: '2026-05-26',
      endDigestDate: '2026-05-30',
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemKey: 'item-1',
      rating: 4,
      followUp: true,
      topicTags: ['AI'],
      matchScore: 0.92,
    });
  });
});
