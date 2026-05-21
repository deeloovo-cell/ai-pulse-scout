import type { NormalizedItem } from '../types/item.js';
import type { DigestConfig } from '../types/config.js';

export function selectItems(items: NormalizedItem[], config: DigestConfig): NormalizedItem[] {
  const qualified = items.filter((i) => i.relevance_scores.overall >= config.min_score);
  const sorted = qualified.sort((a, b) => b.relevance_scores.overall - a.relevance_scores.overall);
  return sorted.slice(0, config.max_items).map((item) => ({
    ...item,
    decision: 'include' as const,
    decision_reason: `score=${item.relevance_scores.overall.toFixed(2)}`,
  }));
}
