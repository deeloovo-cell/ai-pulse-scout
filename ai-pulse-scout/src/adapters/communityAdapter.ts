import type { ProductionSourceAdapter } from './types.js';
import type { SourceIngestionResult } from '../ingest/types.js';
import type { SourceConfig } from '../types/config.js';

export class CommunityAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'community';
  }

  async ingest({ source }: { source: SourceConfig }): Promise<SourceIngestionResult> {
    return {
      source,
      status: 'partial_supported',
      items: [],
      diagnostics: {
        attempted: 1,
        normalized: 0,
        dropped: 0,
        adapterType: 'community',
        reason: 'Community listing ingestion exists only at listing level; destination extraction is not implemented yet.',
      },
    };
  }
}
