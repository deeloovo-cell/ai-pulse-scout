import { join } from 'node:path';
import { openPipelineDb, initializePipelineSchema } from '../state/db.js';
import { createRun, markRunReadyForProcessing, updateRunCounters } from '../state/runRepository.js';
import {
  insertDiscoveredItems,
  listItemsForRun,
  markEnrichmentFailed,
  markDeferredForRetry,
} from '../state/itemRepository.js';
import { runFetchWorkerOnce } from './fetchWorker.js';
import { runEnrichmentWorkerOnce } from './enrichmentWorker.js';
import { evaluatePublishThreshold } from './publishThreshold.js';
import type { NormalizedItem } from '../types/item.js';

export async function runPipeline(input: {
  now: Date;
  dbPath?: string;
  ingest: () => Promise<{ items: Array<{ id: string; sourceId: string; url: string; title: string; publishedAt: string | null; dedupeKey: string; normalizedItem?: NormalizedItem }> }>;
  fetchItem: (item: { id: string; url: string; title: string }) => Promise<{ rawContent: string; cleanContent: string; fetchMethod: string }>;
  enrichItem: (item: { id: string; title: string; clean_content: string | null }) => Promise<{
    summary: string;
    whyItMatters: string;
    topics: string[];
    relevanceScore: number;
    relevanceBucket: string;
    rawResponse: string;
    model: string;
    durationMs: number;
  }>;
  render: (items: unknown[]) => string;
  publish: (html: string) => Promise<void>;
}) {
  const db = openPipelineDb(input.dbPath ?? join(process.cwd(), 'data/state/pipeline.sqlite'));
  initializePipelineSchema(db);

  const runId = `run-${input.now.toISOString()}`;
  createRun(db, { id: runId, windowDate: input.now.toISOString().slice(0, 10), startedAt: input.now.toISOString() });

  const ingestion = await input.ingest();
  insertDiscoveredItems(db, runId, ingestion.items);
  markRunReadyForProcessing(db, runId, new Date().toISOString());

  while (await runFetchWorkerOnce(db, input.fetchItem)) {
    // keep draining fetch work
  }

  while (true) {
    try {
      const worked = await runEnrichmentWorkerOnce(db, input.enrichItem);
      if (!worked) break;
    } catch {
      const items = listItemsForRun(db, runId) as Array<{ id: string; enrichment_status: string }>;
      const running = items.find((item) => item.enrichment_status === 'running');
      if (running) markEnrichmentFailed(db, running.id);
    }
  }

  const items = listItemsForRun(db, runId) as Array<{ id: string; final_status: string }>;
  const successfulItems = items.filter((item) => item.final_status === 'ready').length;
  const failedItems = items.filter((item) => item.final_status === 'fetch_failed' || item.final_status === 'enrichment_failed').length;
  const totalItems = items.length;

  const threshold = evaluatePublishThreshold({ totalItems, successfulItems, failedItems });

  let deferredItems = 0;
  let readyItems: NormalizedItem[] = [];
  let html: string | undefined;

  if (threshold.publishable) {
    for (const item of items.filter((entry) => entry.final_status !== 'ready')) {
      markDeferredForRetry(db, item.id, `retry-${runId}`);
      deferredItems += 1;
    }

    updateRunCounters(db, runId, {
      totalItems,
      terminalItems: successfulItems + failedItems + deferredItems,
      successfulItems,
      failedItems,
      deferredItems,
    });

    readyItems = (listItemsForRun(db, runId) as Array<{ final_status: string; normalized_item_json?: string | null }>).
      filter((item) => item.final_status === 'ready').
      map((item) => item.normalized_item_json ? reviveNormalizedItem(JSON.parse(item.normalized_item_json)) : item);
    html = input.render(readyItems);
    await input.publish(html);
  } else {
    for (const item of items.filter((entry) => entry.final_status !== 'ready')) {
      markDeferredForRetry(db, item.id, `retry-${runId}`);
      deferredItems += 1;
    }

    updateRunCounters(db, runId, {
      totalItems,
      terminalItems: successfulItems + failedItems + deferredItems,
      successfulItems,
      failedItems,
      deferredItems,
    });
  }

  db.close();
  return { publishable: threshold.publishable, failedItems, totalItems, deferredItems, items: readyItems, html };
}

function reviveNormalizedItem(value: NormalizedItem): NormalizedItem {
  return {
    ...value,
    published_at: value.published_at ? new Date(value.published_at) : null,
    fetched_at: new Date(value.fetched_at),
  };
}
