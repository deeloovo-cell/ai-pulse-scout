import type { NormalizedItem } from '../types/item.js';
import { isInLedger } from '../state/ledger.js';

/**
 * Remove items that are already in the sent ledger or are duplicates within this batch.
 * Returns only items not previously seen.
 */
export function dedupeItems(items: NormalizedItem[], ledgerSeen: Set<string>): NormalizedItem[] {
  const seenInBatch = new Set<string>();
  const result: NormalizedItem[] = [];

  for (const item of items) {
    if (isInLedger(item, ledgerSeen)) continue;
    if (seenInBatch.has(item.fingerprint)) continue;
    if (item.item_url && seenInBatch.has(item.item_url.trim().toLowerCase())) continue;

    seenInBatch.add(item.fingerprint);
    if (item.item_url) seenInBatch.add(item.item_url.trim().toLowerCase());
    result.push(item);
  }

  return result;
}
