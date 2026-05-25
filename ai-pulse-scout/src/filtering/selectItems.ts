import type { NormalizedItem } from '../types/item.js';
import type { DigestConfig } from '../types/config.js';

export function selectItems(items: NormalizedItem[], config: DigestConfig): NormalizedItem[] {
  const _config = config;
  const sorted = [...items].sort((a, b) => getSortTime(b) - getSortTime(a));
  return sorted.map((item) => ({
    ...item,
    decision: 'include' as const,
    decision_reason: 'included: updated in collection window',
  }));
}

function getSortTime(item: NormalizedItem): number {
  return item.published_at?.getTime() ?? item.fetched_at.getTime();
}
