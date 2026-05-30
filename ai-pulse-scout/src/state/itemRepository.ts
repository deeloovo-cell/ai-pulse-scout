import type { PipelineDb } from './db.js';

interface DiscoveredItemInput {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  dedupeKey: string;
  normalizedItem?: unknown;
}

function itemKeyFor(runId: string, itemId: string): string {
  return `${runId}:${itemId}`;
}

function getLatestItemKey(db: PipelineDb, itemId: string): string {
  const row = db
    .prepare(`SELECT item_key FROM items WHERE id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(itemId) as { item_key: string } | undefined;

  if (!row) throw new Error(`Item not found: ${itemId}`);
  return row.item_key;
}

export function insertDiscoveredItems(db: PipelineDb, runId: string, items: DiscoveredItemInput[]): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO items (
      item_key, id, run_id, source_id, url, title, published_at, dedupe_key, normalized_item_json,
      content_status, enrichment_status, final_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', ?, ?)`,
  );

  for (const item of items) {
    stmt.run(
      itemKeyFor(runId, item.id),
      item.id,
      runId,
      item.sourceId,
      item.url,
      item.title,
      item.publishedAt,
      item.dedupeKey,
      item.normalizedItem ? JSON.stringify(item.normalizedItem) : null,
      now,
      now,
    );
  }
}

export function claimNextFetchItem(db: PipelineDb) {
  const row = db.prepare(`SELECT item_key FROM items WHERE content_status = 'pending' ORDER BY created_at ASC LIMIT 1`).get() as
    | { item_key: string }
    | undefined;

  if (!row) return null;

  db.prepare(`UPDATE items SET content_status = 'running', updated_at = ? WHERE item_key = ?`).run(
    new Date().toISOString(),
    row.item_key,
  );

  return db.prepare(`SELECT * FROM items WHERE item_key = ?`).get(row.item_key);
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
  const itemKey = getLatestItemKey(db, itemId);

  db.prepare(
    `INSERT OR REPLACE INTO item_contents (
      item_key, raw_content, clean_content, content_length, fetch_method, fetch_completed_at, fetch_duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemKey,
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
     WHERE item_key = ?`,
  ).run(input.completedAt, itemKey);
}

export function claimNextEnrichmentItem(db: PipelineDb) {
  const row = db.prepare(
    `SELECT item_key FROM items WHERE content_status = 'done' AND enrichment_status = 'pending' ORDER BY updated_at ASC LIMIT 1`,
  ).get() as { item_key: string } | undefined;

  if (!row) return null;

  db.prepare(`UPDATE items SET enrichment_status = 'running', updated_at = ? WHERE item_key = ?`).run(
    new Date().toISOString(),
    row.item_key,
  );

  return db.prepare(
    `SELECT items.*, item_contents.clean_content
     FROM items
     LEFT JOIN item_contents ON item_contents.item_key = items.item_key
     WHERE items.item_key = ?`,
  ).get(row.item_key);
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
  const itemKey = getLatestItemKey(db, itemId);

  db.prepare(
    `INSERT OR REPLACE INTO item_enrichments (
      item_key, model, prompt_version, summary, why_it_matters, topics_json,
      relevance_score, relevance_bucket, raw_response, duration_ms, created_at
    ) VALUES (?, ?, 'phase1', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    itemKey,
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
     WHERE item_key = ?`,
  ).run(new Date().toISOString(), itemKey);
}

export function markEnrichmentFailed(db: PipelineDb, itemId: string): void {
  db.prepare(
    `UPDATE items
     SET enrichment_status = 'failed', final_status = 'enrichment_failed', updated_at = ?
     WHERE id = ? AND final_status = 'pending'`,
  ).run(new Date().toISOString(), itemId);
}

export function markDeferredForRetry(db: PipelineDb, itemId: string, nextRunId: string): void {
  db.prepare(
    `UPDATE items
     SET final_status = 'deferred_for_retry', carry_forward_run_id = ?, updated_at = ?
     WHERE id = ? AND final_status != 'ready'`,
  ).run(nextRunId, new Date().toISOString(), itemId);
}

export function recordAttempt(
  db: PipelineDb,
  itemId: string,
  input: {
    stage: string;
    attemptNumber: number;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    outcome: string;
    errorMessage: string | null;
  },
): void {
  const itemKey = getLatestItemKey(db, itemId);
  db.prepare(
    `INSERT INTO item_attempts (
      id, item_key, stage, attempt_number, started_at, completed_at, duration_ms, outcome, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `${itemKey}:${input.stage}:${input.attemptNumber}`,
    itemKey,
    input.stage,
    input.attemptNumber,
    input.startedAt,
    input.completedAt,
    input.durationMs,
    input.outcome,
    input.errorMessage,
  );
}

export function listAttemptsForItem(db: PipelineDb, itemId: string) {
  return db
    .prepare(
      `SELECT item_attempts.*
       FROM item_attempts
       JOIN items ON items.item_key = item_attempts.item_key
       WHERE items.id = ?
       ORDER BY item_attempts.started_at ASC`,
    )
    .all(itemId);
}

export function listItemsForRun(db: PipelineDb, runId: string) {
  return db.prepare(`SELECT * FROM items WHERE run_id = ? ORDER BY created_at ASC`).all(runId);
}
