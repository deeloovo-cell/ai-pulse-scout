import type { SourceConfig } from '../types/config.js';
import type { ContentType, DigestTopic, ItemDecision, RelevanceScores } from '../types/item.js';

export type PublishedAtConfidence =
  | 'exact'
  | 'inferred'
  | 'weak'
  | 'unknown'
  | 'derived'
  | 'fallback_discovered_at';

export type WebpageExtractionLevel = 'article_full' | 'article_partial' | 'link_only';
export type WebpageCandidateOrigin =
  | 'feed_auto_discovery'
  | 'entry_page_direct_article'
  | 'listing_page_candidate'
  | 'listing_page_upgraded_detail';
export type WebpageDegradeReason =
  | 'detail_fetch_failed'
  | 'content_extraction_failed'
  | 'missing_published_at'
  | 'insufficient_article_signals'
  | 'listing_only_candidate';

export interface WebpageExtractionMetadata {
  extractionLevel?: WebpageExtractionLevel;
  candidateOrigin?: WebpageCandidateOrigin;
  degradeReason?: WebpageDegradeReason | null;
  publishedAtConfidence?: PublishedAtConfidence;
}

export type ProductionSupportStatus =
  | 'production_supported'
  | 'partial_supported'
  | 'discoverable_only'
  | 'deferred'
  | 'broken';

export interface IngestionDiagnostics {
  attempted: number;
  normalized: number;
  dropped: number;
  capped?: number;
  reason?: string;
  adapterType?: string;
}

export interface IngestedItem {
  sourceType: string;
  sourceUrl: string;
  sourceName: string;
  itemUrl: string;
  canonicalUrl: string | null;
  title: string;
  publishedAt: string | null;
  publishedAtConfidence: PublishedAtConfidence;
  discoveredAt: string;
  content: string;
  summaryMaterial: string;
  stableIdentity: string;
  topicHints: string[];
  rawMetadata: Record<string, unknown> & WebpageExtractionMetadata;

  id: string;
  source_name: string;
  source_category: string;
  source_url: string;
  item_url: string;
  published_at: Date | null;
  fetched_at: Date;
  author: string;
  content_text: string;
  content_html?: string;
  summary: string;
  key_insight?: string;
  tags: string[];
  content_type: ContentType;
  fingerprint: string;
  relevance_scores: RelevanceScores;
  decision: ItemDecision;
  decision_reason: string;
  primary_topic: DigestTopic;
}

export interface SourceIngestionResult {
  source: SourceConfig;
  status: ProductionSupportStatus;
  items: IngestedItem[];
  diagnostics: IngestionDiagnostics;
}

export interface IngestAllSourcesResult {
  items: IngestedItem[];
  results: SourceIngestionResult[];
  summary: {
    totalSources: number;
    totalItems: number;
    byStatus: Record<ProductionSupportStatus, number>;
  };
}
