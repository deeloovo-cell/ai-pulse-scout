import type { Item as RssItem } from 'rss-parser';
import { randomUUID } from 'crypto';
import type { NormalizedItem, ContentType } from '../types/item.js';
import type { SourceConfig } from '../types/config.js';
import { fingerprint } from './fingerprint.js';

type ExtendedRssItem = RssItem & {
  author?: string;
  'content:encoded'?: string;
};

export function normalizeRssItem(raw: ExtendedRssItem, source: SourceConfig): NormalizedItem {
  const url = raw.link ?? raw.guid ?? '';
  const title = raw.title ?? '(untitled)';
  const publishedAt = parseDate(raw.pubDate ?? raw.isoDate ?? null);
  const contentText = stripHtml(raw.contentSnippet ?? raw.content ?? raw.summary ?? '');
  const contentHtml = raw.content ?? raw['content:encoded'] ?? undefined;

  return {
    id: randomUUID(),
    source_name: source.name,
    source_category: source.category,
    source_url: source.url,
    item_url: url,
    title,
    published_at: publishedAt,
    fetched_at: new Date(),
    author: raw.creator ?? raw.author ?? '',
    content_text: contentText,
    content_html: contentHtml,
    summary: contentText.slice(0, 300),
    tags: [],
    content_type: inferContentType(source),
    fingerprint: fingerprint(url, title),
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
  };
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferContentType(source: SourceConfig): ContentType {
  switch (source.type) {
    case 'youtube': return 'video';
    case 'podcast': return 'podcast';
    case 'github': return 'repo_update';
    default:
      if (source.category === 'research') return 'research';
      return 'article';
  }
}
