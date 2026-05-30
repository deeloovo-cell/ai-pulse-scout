import { randomUUID } from 'node:crypto';
import { buildStableIdentity } from '../../ingest/identity.js';
import type {
  IngestedItem,
  PublishedAtConfidence,
  WebpageCandidateOrigin,
  WebpageDegradeReason,
  WebpageExtractionLevel,
} from '../../ingest/types.js';
import { inferPrimaryTopic } from '../../topics/inferPrimaryTopic.js';
import type { SourceConfig } from '../../types/config.js';

interface NormalizeWebpageItemInput {
  source: SourceConfig;
  itemUrl: string;
  canonicalUrl: string;
  title: string;
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
  content: string;
  summaryMaterial: string;
  extractionLevel: WebpageExtractionLevel;
  candidateOrigin: WebpageCandidateOrigin;
  degradeReason: WebpageDegradeReason | null;
}

export function normalizeWebpageItem(input: NormalizeWebpageItemInput): IngestedItem {
  const stableIdentity = buildStableIdentity({
    canonicalUrl: input.canonicalUrl,
    itemUrl: input.itemUrl,
    sourceUrl: input.source.url,
    title: input.title,
    publishedAt: input.publishedAt,
  });
  const topic = inferPrimaryTopic({
    sourceUrl: input.source.url,
    title: input.title,
    content: input.content,
  });
  const fetchedAt = new Date();

  return {
    sourceType: 'webpage',
    sourceUrl: input.source.url,
    sourceName: input.source.name,
    itemUrl: input.itemUrl,
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    publishedAt: input.publishedAt,
    publishedAtConfidence: input.publishedAtConfidence,
    discoveredAt: fetchedAt.toISOString(),
    content: input.content,
    summaryMaterial: input.summaryMaterial,
    stableIdentity,
    topicHints: [topic],
    rawMetadata: {
      sourceCategory: input.source.category,
      adapterType: 'webpage',
      extractionLevel: input.extractionLevel,
      candidateOrigin: input.candidateOrigin,
      degradeReason: input.degradeReason,
      publishedAtConfidence: input.publishedAtConfidence,
    },
    id: randomUUID(),
    source_name: input.source.name,
    source_category: input.source.category,
    source_url: input.source.url,
    item_url: input.itemUrl,
    published_at: input.publishedAt ? new Date(input.publishedAt) : null,
    fetched_at: fetchedAt,
    author: '',
    content_text: input.content,
    summary: input.summaryMaterial,
    tags: [],
    content_type: 'article',
    fingerprint: stableIdentity,
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
    primary_topic: topic,
  };
}
