import type { PipelineDb } from './db.js';

interface DiscoveredItemInput {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  dedupeKey: string;
}

export function insertDiscoveredItems(db: PipelineDb, runId: string, items: DiscoveredItemInput[]): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO items (
      id, run_id, source_id, url, title, published_at, dedupe_key,
      content_status, enrichment_status, final_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', ?, ?)`,
  );

  for (const item of items) {
    stmt.run(
      item.id,
      runId,
      item.sourceId,
      item.url,
      item.title,
      item.publishedAt,
      item.dedupeKey,
      now,
      now,
    );
  }
}

export function claimNextFetchItem(db: PipelineDb) {
  const row = db.prepare(
    `SELECT id FROM items WHERE content_status = 'pending' ORDER BY created_at ASC LIMIT 1`,
  ).get() as { id: string } | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE items SET content_status = 'running', updated_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), row.id);

  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(row.id);
}

export function markFetchDone(
  db: PipelineDb,
  itemId: string,
  input: {
    rawContent: string;
    cleanContent: string;
    fetchMethod: string;
    durationMs: number;
    completedAt: string;
  },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO item_contents (
      item_id, raw_content, clean_content, content_length, fetch_method, fetch_completed_at, fetch_duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    input.rawContent,
    input.cleanContent,
    input.cleanContent.length,
    input.fetchMethod,
    input.completedAt,
    input.durationMs,
  );

  db.prepare(
    `UPDATE items
     SET content_status = 'done', enrichment_status = 'pending', updated_at = ?
     WHERE id = ?`,
  ).run(input.completedAt, itemId);
}

export function claimNextEnrichmentItem(db: PipelineDb) {
  const row = db.prepare(
    `SELECT id FROM items WHERE content_status = 'done' AND enrichment_status = 'pending' ORDER BY updated_at ASC LIMIT 1`,
  ).get() as { id: string } | undefined;

  if (!row) return null;

  db.prepare(`UPDATE items SET enrichment_status = 'running', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id);

  return db.prepare(
    `SELECT items.*, item_contents.clean_content
     FROM items
     LEFT JOIN item_contents ON item_contents.item_id = items.id
     WHERE items.id = ?`,
  ).get(row.id);
}

export function markEnrichmentDone(
  db: PipelineDb,
  itemId: string,
  result: {
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO item_enrichments (
      item_id, model, prompt_version, summary, why_it_matters, topics_json,
      relevance_score, relevance_bucket, raw_response, duration_ms, created_at
    ) VALUES (?, ?, 'phase1', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemId,
    result.model,
    result.summary,
    result.whyItMatters,
    JSON.stringify(result.topics),
    result.relevanceScore,
    result.relevanceBucket,
    result.rawResponse,
    result.durationMs,
    new Date().toISOString(),
  );

  db.prepare(
    `UPDATE items
     SET enrichment_status = 'done', final_status = 'ready', updated_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), itemId);
}

export function markEnrichmentFailed(db: PipelineDb, itemId: string): void {
  db.prepare(
    `UPDATE items
     SET enrichment_status = 'failed', final_status = 'enrichment_failed', updated_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), itemId);
}

export function markDeferredForRetry(db: PipelineDb, itemId: string, nextRunId: string): void {
  db.prepare(
    `UPDATE items
     SET final_status = 'deferred_for_retry', carry_forward_run_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextRunId, new Date().toISOString(), itemId);
}

export function listItemsForRun(db: PipelineDb, runId: string) {
  return db.prepare(`SELECT * FROM items WHERE run_id = ? ORDER BY created_at ASC`).all(runId);
}
