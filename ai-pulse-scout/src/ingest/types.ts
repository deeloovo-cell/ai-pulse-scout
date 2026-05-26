import type { SourceConfig } from '../types/config.js';

export type PublishedAtConfidence = 'exact' | 'inferred' | 'weak' | 'unknown';
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
  rawMetadata: Record<string, unknown>;
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
