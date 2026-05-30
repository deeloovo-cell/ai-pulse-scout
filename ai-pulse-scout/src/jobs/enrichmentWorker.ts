import type { PipelineDb } from '../state/db.js';
import { claimNextEnrichmentItem, markEnrichmentDone, recordAttempt } from '../state/itemRepository.js';

export async function runEnrichmentWorkerOnce(
  db: PipelineDb,
  enrichItem: (item: { id: string; title: string; clean_content: string | null }) => Promise<{
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  }>,
): Promise<boolean> {
  const item = claimNextEnrichmentItem(db) as { id: string; title: string; clean_content: string | null } | null;
  if (!item) return false;

  const started = Date.now();
  const startedAt = new Date().toISOString();
  const result = await enrichItem(item);
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - started;

  markEnrichmentDone(db, item.id, result);
  recordAttempt(db, item.id, {
    stage: 'enrichment',
    attemptNumber: 1,
    startedAt,
    completedAt,
    durationMs,
    outcome: 'succeeded',
    errorMessage: null,
  });
  return true;
}
