import 'dotenv/config';
import { resolve } from 'node:path';
import { readSelectedSnapshot, defaultSelectedSnapshotPath } from '../static/selectedSnapshot.js';
import { exportStaticSite } from '../static/exportStaticSite.js';
import { defaultStaticSiteOutputDir } from '../static/exportStaticSiteCli.js';
import { enrichSelectedItems, DEFAULT_ENRICHMENT_CAP } from '../insights/enrichSelectedItems.js';
import { gateByLlmRelevance } from '../filtering/gateByLlmRelevance.js';
import type { NormalizedItem } from '../types/item.js';

export async function renderStaticSiteFromSnapshot(options: {
  date: string;
  snapshotPath?: string;
  outputDir?: string;
  enrichItems?: (items: NormalizedItem[]) => Promise<NormalizedItem[]>;
}): Promise<{ snapshotPath: string; selected: number; rendered: number; indexPath: string }> {
  const outputDir = resolve(options.outputDir ?? defaultStaticSiteOutputDir());
  const snapshotPath = resolve(options.snapshotPath ?? defaultSelectedSnapshotPath(outputDir, options.date));
  const selected = await readSelectedSnapshot(snapshotPath);
  if (selected.length === 0) {
    throw new Error(`Selected snapshot is empty: ${snapshotPath}`);
  }

  const enrichItems = options.enrichItems ?? ((items: NormalizedItem[]) => enrichSelectedItems(items, DEFAULT_ENRICHMENT_CAP));
  const enriched = await enrichItems(selected);
  const gated = gateByLlmRelevance(enriched);
  const result = await exportStaticSite({
    outputDir,
    siteTitle: 'The Daily Scout',
    targetDate: options.date,
    items: gated.items,
  });

  return {
    snapshotPath,
    selected: selected.length,
    rendered: gated.items.length,
    indexPath: result.indexPath,
  };
}

function readFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const date = readFlag('--date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('Usage: tsx src/cli/renderStaticSiteFromSnapshot.ts --date YYYY-MM-DD [--snapshot path] [--output-dir path]');
    process.exit(1);
  }

  const snapshotPath = readFlag('--snapshot') ?? undefined;
  const outputDir = readFlag('--output-dir') ?? undefined;

  const result = await renderStaticSiteFromSnapshot({ date, snapshotPath, outputDir });
  console.log(`Snapshot: ${result.snapshotPath}`);
  console.log(`Selected: ${result.selected}`);
  console.log(`Rendered: ${result.rendered}`);
  console.log(`Index: ${result.indexPath}`);
}
