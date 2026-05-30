import type { ProductionSourceAdapter } from './types.js';
import type { SourceIngestionResult } from '../ingest/types.js';
import type { SourceConfig } from '../types/config.js';

export class PapersAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'papers';
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
        adapterType: 'papers',
        reason: 'Papers metadata and abstract extraction is not implemented yet.',
      },
    };
  }
}
