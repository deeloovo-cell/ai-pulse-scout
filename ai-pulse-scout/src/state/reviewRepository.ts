import type { PipelineDb } from './db.js';

export interface DigestReviewSnapshotItemInput {
  itemKey: string;
  publishedAt: string | null;
  title: string;
  excerpt: string;
  itemUrl: string | null;
  sourceName: string | null;
  topicTags: string[];
  matchScore: number;
  normalizedItemJson: string | null;
}

export interface SaveDigestReviewItemsInput {
  digestDate: string;
  runId: string;
  items: DigestReviewSnapshotItemInput[];
}

export interface ReviewWindowItem {
  digestDate: string;
  runId: string;
  itemKey: string;
  publishedAt: string | null;
  title: string;
  excerpt: string;
  itemUrl: string | null;
  sourceName: string | null;
  topicTags: string[];
  matchScore: number;
  normalizedItemJson: string | null;
  rating: number | null;
  followUp: boolean;
  updatedAt: string | null;
}

export function saveDigestReviewItems(db: PipelineDb, input: SaveDigestReviewItemsInput): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO digest_review_items (
      digest_date,
      run_id,
      item_key,
      published_at,
      title,
      excerpt,
      item_url,
      source_name,
      topic_tags_json,
      match_score,
      normalized_item_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: DigestReviewSnapshotItemInput[]) => {
    for (const item of items) {
      insert.run(
        input.digestDate,
        input.runId,
        item.itemKey,
        item.publishedAt,
        item.title,
        item.excerpt,
        item.itemUrl,
        item.sourceName,
        JSON.stringify(item.topicTags),
        item.matchScore,
        item.normalizedItemJson,
      );
    }
  });

  transaction(input.items);
}

export function upsertItemReview(db: PipelineDb, input: { itemKey: string; rating: number | null; followUp: boolean }): void {
  db.prepare(`
    INSERT INTO digest_item_reviews (
      item_key,
      rating,
      follow_up,
      updated_at
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_key) DO UPDATE SET
      rating = excluded.rating,
      follow_up = excluded.follow_up,
      updated_at = CURRENT_TIMESTAMP
  `).run(input.itemKey, input.rating, input.followUp ? 1 : 0);
}

export function listReviewItemsWindow(
  db: PipelineDb,
  input: { startDigestDate: string; endDigestDate: string },
): ReviewWindowItem[] {
  const rows = db.prepare(`
    SELECT
      dri.digest_date AS digestDate,
      dri.run_id AS runId,
      dri.item_key AS itemKey,
      dri.published_at AS publishedAt,
      dri.title AS title,
      dri.excerpt AS excerpt,
      dri.item_url AS itemUrl,
      dri.source_name AS sourceName,
      dri.topic_tags_json AS topicTagsJson,
      dri.match_score AS matchScore,
      dri.normalized_item_json AS normalizedItemJson,
      dir.rating AS rating,
      dir.follow_up AS followUp,
      dir.updated_at AS updatedAt
    FROM digest_review_items dri
    LEFT JOIN digest_item_reviews dir ON dir.item_key = dri.item_key
    WHERE dri.digest_date >= ? AND dri.digest_date <= ?
    ORDER BY dri.published_at ASC, dri.item_key ASC
  `).all(input.startDigestDate, input.endDigestDate) as Array<{
    digestDate: string;
    runId: string;
    itemKey: string;
    publishedAt: string | null;
    title: string;
    excerpt: string;
    itemUrl: string | null;
    sourceName: string | null;
    topicTagsJson: string;
    matchScore: number;
    normalizedItemJson: string | null;
    rating: number | null;
    followUp: number | null;
    updatedAt: string | null;
  }>;

  return rows.map((row) => ({
    digestDate: row.digestDate,
    runId: row.runId,
    itemKey: row.itemKey,
    publishedAt: row.publishedAt,
    title: row.title,
    excerpt: row.excerpt,
    itemUrl: row.itemUrl,
    sourceName: row.sourceName,
    topicTags: JSON.parse(row.topicTagsJson) as string[],
    matchScore: row.matchScore,
    normalizedItemJson: row.normalizedItemJson,
    rating: row.rating,
    followUp: Boolean(row.followUp ?? 0),
    updatedAt: row.updatedAt,
  }));
}
