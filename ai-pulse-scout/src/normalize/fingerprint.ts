import { createHash } from 'crypto';

/**
 * Stable fingerprint for an item: based on canonical URL + normalized title.
 * Used by the sent ledger to identify duplicates across fetches.
 */
export function fingerprint(url: string, title: string): string {
  const normalized = `${canonicalizeUrl(url)}||${normalizeTitle(title)}`;
  return createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Drop utm_ tracking params and fragment
    const stripped = new URL(u.origin + u.pathname + u.search);
    for (const key of [...stripped.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'source') {
        stripped.searchParams.delete(key);
      }
    }
    return stripped.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}
