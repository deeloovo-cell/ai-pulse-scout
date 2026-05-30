import type { PipelineDb } from '../state/db.js';
import { listReviewItemsWindow } from '../state/reviewRepository.js';
import type { ReviewFeedItem } from './reviewTypes.js';

export function listReviewFeedItems(db: PipelineDb, input: { now: Date; days: number }): ReviewFeedItem[] {
  const endDigestDate = input.now.toISOString().slice(0, 10);
  const start = new Date(input.now);
  start.setUTCDate(start.getUTCDate() - (input.days - 1));
  const startDigestDate = start.toISOString().slice(0, 10);

  return listReviewItemsWindow(db, { startDigestDate, endDigestDate }).sort((a, b) => {
    const publishedCompare = (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '');
    if (publishedCompare !== 0) return publishedCompare;
    return a.itemKey.localeCompare(b.itemKey);
  });
}
