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
    const stableKey = item.stableIdentity ?? item.fingerprint;
    const urlKey = item.item_url ? item.item_url.trim().toLowerCase() : '';

    if (isInLedger(item, ledgerSeen)) continue;
    if (stableKey && seenInBatch.has(stableKey)) continue;
    if (urlKey && seenInBatch.has(urlKey)) continue;

    if (stableKey) seenInBatch.add(stableKey);
    if (urlKey) seenInBatch.add(urlKey);
    result.push(item);
  }

  return result;
}
