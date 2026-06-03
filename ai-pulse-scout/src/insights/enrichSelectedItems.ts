import type { NormalizedItem } from '../types/item.js';
import { enrichKeyInsights } from './analyzeKeyInsights.js';

export const DEFAULT_ENRICHMENT_CAP = 50;

export async function enrichSelectedItems(
  items: NormalizedItem[],
  cap = DEFAULT_ENRICHMENT_CAP,
): Promise<NormalizedItem[]> {
  const itemsToEnrich = items.slice(0, cap);
  const enriched = await enrichKeyInsights(itemsToEnrich);
  return enriched.concat(items.slice(cap));
}
