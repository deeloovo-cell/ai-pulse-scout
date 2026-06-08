import type { ProductionSourceAdapter } from '../adapters/types.js';
import { capSourceItems } from '../filtering/capSourceItems.js';
import type { SourceConfig } from '../types/config.js';
import type {
  IngestAllSourcesResult,
  ProductionSupportStatus,
  SourceIngestionResult,
} from './types.js';

interface IngestAllSourcesInput {
  sources: SourceConfig[];
  windowStart: Date;
  windowEnd: Date;
  adapters: ProductionSourceAdapter[];
}

const ALL_STATUSES: ProductionSupportStatus[] = [
  'production_supported',
  'partial_supported',
  'discoverable_only',
  'deferred',
  'broken',
];

export async function ingestAllSources(
  input: IngestAllSourcesInput,
): Promise<IngestAllSourcesResult> {
  const results: SourceIngestionResult[] = [];

  for (const source of input.sources) {
    const adapter = input.adapters.find((candidate) => candidate.canHandle(source));

    if (!adapter) {
      results.push({
        source,
        status: 'broken',
        items: [],
        diagnostics: {
          attempted: 0,
          normalized: 0,
          dropped: 0,
          reason: `No production adapter for source type ${source.type}`,
        },
      });
      continue;
    }

    const ingested = await adapter.ingest({
      source,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    });

    const capped = capSourceItems(ingested.items, 10);

    results.push({
      ...ingested,
      items: capped.items,
      diagnostics: {
        ...ingested.diagnostics,
        aiAccepted: capped.counts.aiAccepted,
        aiRejected: capped.counts.aiRejected,
        capped: capped.counts.capped,
        fallback: capped.counts.fallback,
        dropped:
          ingested.diagnostics.dropped +
          capped.counts.aiRejected +
          (capped.counts.aiAccepted - capped.counts.capped),
      },
    });
  }

  const items = results.flatMap((result) => result.items);
  const byStatus = Object.fromEntries(
    ALL_STATUSES.map((status) => [status, 0]),
  ) as Record<ProductionSupportStatus, number>;

  for (const result of results) {
    byStatus[result.status] += 1;
  }

  return {
    items,
    results,
    summary: {
      totalSources: input.sources.length,
      totalItems: items.length,
      byStatus,
    },
  };
}
