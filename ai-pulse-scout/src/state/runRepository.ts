import type { PipelineDb } from './db.js';

export function createRun(
  db: PipelineDb,
  input: { id: string; windowDate: string; startedAt: string },
): void {
  db.prepare(
    `INSERT INTO runs (id, window_date, status, started_at)
     VALUES (?, ?, 'created', ?)`,
  ).run(input.id, input.windowDate, input.startedAt);
}

export function markRunReadyForProcessing(db: PipelineDb, runId: string, completedAt: string): void {
  db.prepare(
    `UPDATE runs
     SET status = 'ready_for_processing', collection_completed_at = ?
     WHERE id = ?`,
  ).run(completedAt, runId);
}

export function updateRunCounters(
  db: PipelineDb,
  runId: string,
  counters: {
    totalItems: number;
    terminalItems: number;
    successfulItems: number;
    failedItems: number;
    deferredItems: number;
  },
): void {
  db.prepare(
    `UPDATE runs
     SET total_items = ?, terminal_items = ?, successful_items = ?, failed_items = ?, deferred_items = ?
     WHERE id = ?`,
  ).run(
    counters.totalItems,
    counters.terminalItems,
    counters.successfulItems,
    counters.failedItems,
    counters.deferredItems,
    runId,
  );
}

export function markRunPublished(db: PipelineDb, runId: string, publishedAt: string): void {
  db.prepare(
    `UPDATE runs
     SET status = 'published', published_at = ?, completed_at = ?
     WHERE id = ?`,
  ).run(publishedAt, publishedAt, runId);
}

export function getRunById(db: PipelineDb, runId: string) {
  return db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId);
}
