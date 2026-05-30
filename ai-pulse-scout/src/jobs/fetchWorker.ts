import type { PipelineDb } from '../state/db.js';
import { claimNextFetchItem, markFetchDone } from '../state/itemRepository.js';

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
  const result = await fetchItem(item);

  markFetchDone(db, item.id, {
    rawContent: result.rawContent,
    cleanContent: result.cleanContent,
    fetchMethod: result.fetchMethod,
    durationMs: Date.now() - started,
    completedAt: new Date().toISOString(),
  });

  return true;
}
