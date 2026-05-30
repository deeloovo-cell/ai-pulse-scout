import { resolveUrl } from '../shared/html.js';

interface ExtractCandidateOptions {
  maxCandidates?: number;
}

export function extractCandidates(baseUrl: string, html: string, options: ExtractCandidateOptions = {}): string[] {
  const maxCandidates = options.maxCandidates ?? 10;
  const urls = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => resolveUrl(baseUrl, match[1]))
    .filter((url) => /^https?:\/\//.test(url))
    .filter((url) => !/\/about\/?$|\/contact\/?$|\/privacy\/?$|\/terms\/?$/i.test(url))
    .filter((url) => /\/blog\/|\/post|\/posts\/|\/article|\/articles\/|\/news\/|\/research\//i.test(url));

  return [...new Set(urls)].slice(0, maxCandidates);
}
