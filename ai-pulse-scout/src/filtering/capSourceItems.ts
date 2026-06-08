import type { NormalizedItem } from '../types/item.js';
import { scoreAiRelevance, hasAnyPositiveSignal } from './scoreAiRelevance.js';
import { rankSourceItems } from './rankSourceItems.js';

export interface SourceCapCounts {
  raw: number;
  aiAccepted: number;
  aiRejected: number;
  capped: number;
  fallback: boolean;
}

export interface SourceCapResult {
  items: NormalizedItem[];
  counts: SourceCapCounts;
}

/**
 * Selects up to `limit` items from a source using a two-pass strategy:
 *
 * Pass 1 — scored pool (Option A):
 *   Score each item with scoreAiRelevance. Hard negatives and items with no
 *   positive signal score 0 and are dropped. Soft-negative items score lower
 *   but are not eliminated. Items are sorted by score (desc) then by recency.
 *
 * Pass 2 — adaptive fallback (Option C):
 *   If the scored pool is empty (source had no sufficiently relevant content),
 *   fall back to any item with at least one positive AI signal, ignoring soft
 *   negatives. This prevents a source from silently returning zero items when
 *   it does have borderline content — those items rank last but are still shown.
 */
export function capSourceItems(items: NormalizedItem[], limit = 10): SourceCapResult {
  // Pass 1: score-based selection
  const scored = items
    .map((item) => ({ item, score: scoreAiRelevance(item) }))
    .filter(({ score }) => score > 0);

  let pool: NormalizedItem[];
  let fallback = false;

  if (scored.length > 0) {
    // Sort by relevance score desc, then apply recency/extraction ranking as tiebreaker
    scored.sort((a, b) => b.score - a.score);
    // Group by score tier and apply recency ranking within each tier
    const byTier = new Map<number, NormalizedItem[]>();
    for (const { item, score } of scored) {
      if (!byTier.has(score)) byTier.set(score, []);
      byTier.get(score)!.push(item);
    }
    pool = [];
    const tiers = [...byTier.keys()].sort((a, b) => b - a);
    for (const tier of tiers) {
      pool.push(...rankSourceItems(byTier.get(tier)!));
    }
  } else {
    // Pass 2: adaptive fallback — accept any item with a positive signal
    const fallbackItems = items.filter(hasAnyPositiveSignal);
    pool = rankSourceItems(fallbackItems);
    fallback = fallbackItems.length > 0;
  }

  const capped = pool.slice(0, limit);
  const aiAccepted = scored.length > 0 ? scored.length : (fallback ? pool.length : 0);

  return {
    items: capped,
    counts: {
      raw: items.length,
      aiAccepted,
      aiRejected: items.length - aiAccepted,
      capped: capped.length,
      fallback,
    },
  };
}
