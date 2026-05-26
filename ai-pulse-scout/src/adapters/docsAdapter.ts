import type { ProductionSourceAdapter } from './types.js';
import type { SourceIngestionResult } from '../ingest/types.js';
import type { SourceConfig } from '../types/config.js';

export class DocsAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'docs';
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
        adapterType: 'docs',
        reason: 'Docs significance-aware change extraction is not implemented yet.',
      },
    };
  }
}
