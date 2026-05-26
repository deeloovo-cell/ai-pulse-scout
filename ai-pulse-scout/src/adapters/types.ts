import type { SourceConfig } from '../types/config.js';
import type { SourceIngestionResult } from '../ingest/types.js';

export interface ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean;
  ingest(input: {
    source: SourceConfig;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<SourceIngestionResult>;
}
