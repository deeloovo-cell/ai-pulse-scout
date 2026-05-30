import { normalizePublishedAt } from '../../ingest/timestamps.js';
import type { PublishedAtConfidence } from '../../ingest/types.js';
import { extractCanonicalUrl } from '../shared/html.js';

export interface ExtractedDetail {
  title: string;
  canonicalUrl: string;
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
  content: string;
  summaryMaterial: string;
}

export function extractDetail(url: string, html: string): ExtractedDetail {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? '(untitled)';
  const canonicalUrl = extractCanonicalUrl(html) ?? url;
  const rawPublished = html.match(/article:published_time[^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
  const published = normalizePublishedAt(rawPublished);
  const content = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    title,
    canonicalUrl,
    publishedAt: published.publishedAt,
    publishedAtConfidence: published.publishedAtConfidence,
    content,
    summaryMaterial: content,
  };
}
