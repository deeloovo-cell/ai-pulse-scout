import type { NormalizedItem } from '../types/item.js';

export function rankSourceItems(items: NormalizedItem[]): NormalizedItem[] {
  return [...items].sort((a, b) => {
    const timeDiff = getSortTime(b) - getSortTime(a);
    if (timeDiff !== 0) return timeDiff;

    const extractionDiff = extractionWeight(b) - extractionWeight(a);
    if (extractionDiff !== 0) return extractionDiff;

    return timestampWeight(b) - timestampWeight(a);
  });
}

function getSortTime(item: NormalizedItem): number {
  return item.published_at?.getTime() ?? item.fetched_at.getTime();
}

function extractionWeight(item: NormalizedItem): number {
  const level = item.rawMetadata?.extractionLevel;
  if (level === 'article_full') return 3;
  if (level === 'article_partial') return 2;
  if (level === 'link_only') return 1;
  return 2;
}

function timestampWeight(item: NormalizedItem): number {
  const confidence = item.rawMetadata?.publishedAtConfidence ?? (item.published_at ? 'exact' : 'fallback_discovered_at');
  if (confidence === 'exact') return 2;
  if (confidence === 'derived') return 1;
  return 0;
}
