import type { PipelineDb } from '../state/db.js';
import { claimNextEnrichmentItem, markEnrichmentDone } from '../state/itemRepository.js';

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

  const result = await enrichItem(item);
  markEnrichmentDone(db, item.id, result);
  return true;
}
