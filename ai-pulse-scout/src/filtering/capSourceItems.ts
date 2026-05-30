import type { NormalizedItem } from '../types/item.js';
import { isAiRelevant } from './isAiRelevant.js';
import { rankSourceItems } from './rankSourceItems.js';

export interface SourceCapCounts {
  raw: number;
  aiAccepted: number;
  aiRejected: number;
  capped: number;
}

export interface SourceCapResult {
  items: NormalizedItem[];
  counts: SourceCapCounts;
}

export function capSourceItems(items: NormalizedItem[], limit = 10): SourceCapResult {
  const aiAccepted = items.filter((item) => isAiRelevant(item));
  const ranked = rankSourceItems(aiAccepted);
  const capped = ranked.slice(0, limit);

  return {
    items: capped,
    counts: {
      raw: items.length,
      aiAccepted: aiAccepted.length,
      aiRejected: items.length - aiAccepted.length,
      capped: capped.length,
    },
  };
}
