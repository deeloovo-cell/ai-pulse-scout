import type { NormalizedItem } from '../types/item.js';
import { rankSourceItems } from './rankSourceItems.js';

export interface SourceCapCounts {
  raw: number;
  capped: number;
}

export interface SourceCapResult {
  items: NormalizedItem[];
  counts: SourceCapCounts;
}

/** Keep the newest, highest-quality in-window items without keyword filtering. */
export function capSourceItems(items: NormalizedItem[], limit = 10): SourceCapResult {
  const capped = rankSourceItems(items).slice(0, limit);

  return {
    items: capped,
    counts: {
      raw: items.length,
      capped: capped.length,
    },
  };
}
