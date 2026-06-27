import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { summarizeCoverage } from '../inbox/coverageReport.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import type { CoverageResult } from '../inbox/types.js';
import type { SourceConfig } from '../types/config.js';
import { subHours } from 'date-fns';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../../config');
const raw = yaml.load(readFileSync(join(CONFIG_DIR, 'sources.yaml'), 'utf8')) as { sources: SourceConfig[] };
const enabled = raw.sources.filter((source) => source.enabled !== false);
const now = new Date();
const windowStart = subHours(now, 48);

const results: CoverageResult[] = [];
for (const source of enabled) {
  const fetched = await fetchRssSource(source, windowStart, now);
  if (fetched.error) {
    results.push({
      source: { section: 'rss', subsection: null, label: source.name, url: source.url, line: 0, category: 'rss', classification: { kind: 'feed', strategy: 'rss_parser', platform: 'rss', rationale: 'sources.yaml enabled rss source', traversable: true } },
      status: 'failed',
      discoveredCount: 0,
      error: fetched.error,
    });
  } else {
    results.push({
      source: { section: 'rss', subsection: null, label: source.name, url: source.url, line: 0, category: 'rss', classification: { kind: 'feed', strategy: 'rss_parser', platform: 'rss', rationale: 'sources.yaml enabled rss source', traversable: true } },
      status: fetched.items.length > 0 ? 'success' : 'empty',
      discoveredCount: fetched.items.length,
    });
  }
}

const summary = summarizeCoverage(results);
mkdirSync('data/output/source-coverage', { recursive: true });
writeFileSync(join('data/output/source-coverage', 'latest.json'), JSON.stringify({ summary, results }, null, 2), 'utf8');

console.log('AI Pulse Scout — Source Coverage');
console.log(JSON.stringify(summary, null, 2));
