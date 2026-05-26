import type { DigestTopic } from '../topics/topicOrder.js';
import type { IngestedItem as CoreIngestedItem, WebpageExtractionMetadata } from '../ingest/types.js';

export type ContentType =
  | 'article'
  | 'newsletter'
  | 'video'
  | 'podcast'
  | 'research'
  | 'repo_update';

export type ItemDecision = 'include' | 'exclude' | 'pending';

export interface RelevanceScores {
  ai_engineering: number;
  industrial_ai: number;
  cad_cae_cam: number;
  executive_signal: number;
  aac_relevance: number;
  overall: number;
}

export interface NormalizedItem extends CoreIngestedItem {
  rawMetadata: CoreIngestedItem['rawMetadata'] & WebpageExtractionMetadata;
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
