export const DIGEST_ITEM_CAP = 100;
export const DIGEST_SOURCE_FAMILY_CAP = 10;

export function capDigestItems<T extends { source_name?: string; source_url?: string }>(
  items: T[],
  limit = DIGEST_ITEM_CAP,
  sourceFamilyLimit = DIGEST_SOURCE_FAMILY_CAP,
): T[] {
  const selected: T[] = [];
  const selectedItems = new Set<T>();
  const familyCounts = new Map<string, number>();

  for (const item of items) {
    if (selected.length >= limit) break;

    const family = sourceFamilyKey(item);
    const count = familyCounts.get(family) ?? 0;
    if (count >= sourceFamilyLimit) continue;

    selected.push(item);
    selectedItems.add(item);
    familyCounts.set(family, count + 1);
  }

  for (const item of items) {
    if (selected.length >= limit) break;
    if (selectedItems.has(item)) continue;
    selected.push(item);
  }

  return selected;
}

function sourceFamilyKey(item: { source_name?: string; source_url?: string }): string {
  const sourceName = item.source_name ?? '';
  const sourceUrl = item.source_url ?? '';

  if (/^arxiv\b/i.test(sourceName) || /:\/\/(?:www\.)?arxiv\.org\//i.test(sourceUrl)) {
    return 'arxiv';
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return sourceName.trim().toLowerCase() || 'unknown';
  }
}
