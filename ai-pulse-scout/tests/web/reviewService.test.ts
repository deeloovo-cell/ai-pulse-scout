import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';
import { saveDigestReviewItems, upsertItemReview } from '../../src/state/reviewRepository.js';
import { listReviewFeedItems } from '../../src/web/reviewService.js';

describe('reviewService', () => {
  it('returns only the latest 5-day window sorted by published date ascending with merged review state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-review-feed-'));
    const db = openPipelineDb(join(dir, 'pipeline.sqlite'));
    initializePipelineSchema(db);

    saveDigestReviewItems(db, {
      digestDate: '2026-05-30',
      runId: 'run-1',
      items: [
        { itemKey: 'b', publishedAt: '2026-05-30T12:00:00.000Z', title: 'B', excerpt: 'B', itemUrl: 'https://b', sourceName: 'S', topicTags: ['AI'], matchScore: 0.7, normalizedItemJson: '{}' },
        { itemKey: 'a', publishedAt: '2026-05-29T12:00:00.000Z', title: 'A', excerpt: 'A', itemUrl: 'https://a', sourceName: 'S', topicTags: ['ML'], matchScore: 0.9, normalizedItemJson: '{}' },
      ],
    });
    saveDigestReviewItems(db, {
      digestDate: '2026-05-24',
      runId: 'run-2',
      items: [
        { itemKey: 'old', publishedAt: '2026-05-24T08:00:00.000Z', title: 'Old', excerpt: 'Old', itemUrl: 'https://old', sourceName: 'S', topicTags: ['Old'], matchScore: 0.1, normalizedItemJson: '{}' },
      ],
    });
    upsertItemReview(db, { itemKey: 'a', rating: 5, followUp: true });

    const items = listReviewFeedItems(db, { now: new Date('2026-05-30T13:00:00.000Z'), days: 5 });

    expect(items.map((item) => item.itemKey)).toEqual(['a', 'b']);
    expect(items[0]).toMatchObject({ rating: 5, followUp: true });
    expect(items[1]).toMatchObject({ rating: null, followUp: false });
  });
});
