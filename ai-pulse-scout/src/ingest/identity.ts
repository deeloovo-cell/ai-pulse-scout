interface StableIdentityInput {
  canonicalUrl?: string | null;
  itemUrl?: string | null;
  sourceUrl: string;
  title: string;
  publishedAt?: string | null;
  sourceSpecificId?: string | null;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.searchParams.delete('utm_source');
  parsed.searchParams.delete('utm_medium');
  parsed.searchParams.delete('utm_campaign');
  parsed.searchParams.delete('ref');
  const normalized = parsed.toString();
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function buildStableIdentity(input: StableIdentityInput): string {
  if (input.canonicalUrl) {
    return `url:${normalizeUrl(input.canonicalUrl)}`;
  }

  if (input.sourceSpecificId) {
    return `source-id:${input.sourceSpecificId}`;
  }

  if (input.itemUrl) {
    return `url:${normalizeUrl(input.itemUrl)}`;
  }

  return `fallback:${input.sourceUrl}::${input.title}::${input.publishedAt ?? 'unknown'}`;
}
