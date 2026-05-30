import type { PipelineDb } from '../state/db.js';
import { claimNextFetchItem, markFetchDone, recordAttempt } from '../state/itemRepository.js';

export async function runFetchWorkerOnce(
  db: PipelineDb,
  fetchItem: (item: { id: string; url: string; title: string }) => Promise<{
    rawContent: string;
    cleanContent: string;
    fetchMethod: string;
  }>,
): Promise<boolean> {
  const item = claimNextFetchItem(db) as { id: string; url: string; title: string } | null;
  if (!item) return false;

  const started = Date.now();
  const startedAt = new Date().toISOString();
  const result = await fetchItem(item);
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - started;

  markFetchDone(db, item.id, {
    rawContent: result.rawContent,
    cleanContent: result.cleanContent,
    fetchMethod: result.fetchMethod,
    durationMs,
    completedAt,
  });

  recordAttempt(db, item.id, {
    stage: 'fetch',
    attemptNumber: 1,
    startedAt,
    completedAt,
    durationMs,
    outcome: 'succeeded',
    errorMessage: null,
  });

  return true;
}
