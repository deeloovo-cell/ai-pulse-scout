import 'dotenv/config';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';
import { loadConfig } from '../config/loadConfig.js';
import { dedupeItems } from '../filtering/dedupeItems.js';
import { selectItems } from '../filtering/selectItems.js';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { enrichSelectedItems, DEFAULT_ENRICHMENT_CAP } from '../insights/enrichSelectedItems.js';
import { exportStaticSite } from '../static/exportStaticSite.js';
import {
  capStaticDigestItems,
  computeDigestWindowForDate,
  defaultStaticSiteOutputDir,
} from '../static/exportStaticSiteCli.js';
import { logger } from '../utils/logger.js';

function readFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const date = readFlag('--date');
const outputDirArg = readFlag('--output-dir');

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: npm run site:export -- --date YYYY-MM-DD [--output-dir path]');
  process.exit(1);
}

const outputDir = resolve(outputDirArg ?? defaultStaticSiteOutputDir());
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const config = loadConfig();
const { windowStart, windowEnd } = computeDigestWindowForDate(date);

logger.info(`Static site export for digest date ${date}`);
logger.info(`Window: ${windowStart.toISOString()} -> ${windowEnd.toISOString()}`);
logger.info(`Output dir: ${outputDir}`);

const ingestion = await ingestAllSources({
  sources: config.sources,
  windowStart,
  windowEnd,
  adapters: [
    new FeedAdapter(),
    new GenericWebAdapter(),
    new YouTubeAdapter(),
    new GitHubAdapter(),
    new DocsAdapter(),
    new CommunityAdapter(),
    new PapersAdapter(),
  ],
});

logger.info(`Unified ingestion fetched ${ingestion.items.length} items across ${ingestion.summary.totalSources} sources`);

const deduped = dedupeItems(ingestion.items, new Set<string>());
logger.info(`After dedupe: ${deduped.length} items`);

const ordered = selectItems(deduped, config.digest);
logger.info(`After ordering: ${ordered.length} items`);

const capped = capStaticDigestItems(ordered);
logger.info(`After static digest cap: ${capped.length} items`);

const enriched = await enrichSelectedItems(capped, DEFAULT_ENRICHMENT_CAP);
logger.info(`After enrichment: ${enriched.length} items`);

const result = await exportStaticSite({
  outputDir,
  siteTitle: 'The Daily Scout',
  targetDate: date,
  recentDays: [date],
  items: enriched,
});

console.log('---');
console.log(`Digest date: ${date}`);
console.log(`Items:       ${enriched.length}`);
console.log(`Index:       ${result.indexPath}`);
console.log(`Day page:    ${result.dayPath}`);
