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
import { gateByLlmRelevance } from '../filtering/gateByLlmRelevance.js';
import { prepareDigestItems } from '../filtering/prepareDigestItems.js';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { enrichSelectedItems, DEFAULT_ENRICHMENT_CAP } from '../insights/enrichSelectedItems.js';
import { exportStaticSite } from '../static/exportStaticSite.js';
import {
  defaultStaticSiteOutputDir,
  resolveStaticSiteBuildWindow,
} from '../static/exportStaticSiteCli.js';
import { logger } from '../utils/logger.js';

function readFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const date = readFlag('--date');
const outputDirArg = readFlag('--output-dir');
const windowStartArg = readFlag('--window-start');
const windowEndArg = readFlag('--window-end');

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: npm run site:export -- --date YYYY-MM-DD [--output-dir path]');
  process.exit(1);
}

const outputDir = resolve(outputDirArg ?? defaultStaticSiteOutputDir());
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const config = loadConfig();
const { windowStart, windowEnd, source } = resolveStaticSiteBuildWindow({
  digestDate: date,
  windowStartIso: windowStartArg ?? undefined,
  windowEndIso: windowEndArg ?? undefined,
});

logger.info(`Static site export for digest date ${date}`);
logger.info(`Window source: ${source}`);
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

const { deduped, ordered, selected } = prepareDigestItems(ingestion.items, config.digest);
logger.info(`After dedupe: ${deduped.length} items`);
logger.info(`After ordering: ${ordered.length} items`);
logger.info(`After static digest cap: ${selected.length} items`);

const enriched = await enrichSelectedItems(selected, DEFAULT_ENRICHMENT_CAP);
logger.info(`After enrichment: ${enriched.length} items`);

const gated = gateByLlmRelevance(enriched);
logger.info(`After LLM relevance gate: ${gated.kept} items (dropped ${gated.dropped} rated Low)`);

const result = await exportStaticSite({
  outputDir,
  siteTitle: 'The Daily Scout',
  targetDate: date,
  items: gated.items,
});

console.log('---');
console.log(`Digest date: ${date}`);
console.log(`Items:       ${gated.items.length}`);
console.log(`Index:       ${result.indexPath}`);
