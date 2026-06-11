import type { NormalizedItem } from '../types/item.js';

export interface RelevanceGateResult {
  items: NormalizedItem[];
  kept: number;
  dropped: number;
}

/**
 * Post-enrichment relevance gate.
 *
 * Uses the LLM-assigned `executive_insight.manufacturing_relevance` rating to
 * shape the final digest:
 *
 *   - 'Low'              → dropped from the digest
 *   - 'High'             → ranked first
 *   - 'Medium' / missing → ranked after High, in original (recency) order
 *
 * Missing ratings are treated as 'Medium' rather than dropped, so runs without
 * an LLM API key (fallback insights) still produce a digest — in that mode the
 * keyword score applied at ingestion remains the only relevance filter.
 *
 * The sort is stable: within each relevance tier the incoming order
 * (recency, extraction quality) is preserved.
 */
export function gateByLlmRelevance(items: NormalizedItem[]): RelevanceGateResult {
  const kept = items.filter((item) => relevanceOf(item) !== 'Low');
  const sorted = [...kept].sort((a, b) => relevanceWeight(b) - relevanceWeight(a));

  return {
    items: sorted,
    kept: sorted.length,
    dropped: items.length - sorted.length,
  };
}

function relevanceOf(item: NormalizedItem): 'High' | 'Medium' | 'Low' | undefined {
  return item.executive_insight?.manufacturing_relevance;
}

function relevanceWeight(item: NormalizedItem): number {
  const relevance = relevanceOf(item) ?? 'Medium';
  return relevance === 'High' ? 2 : 1;
}
