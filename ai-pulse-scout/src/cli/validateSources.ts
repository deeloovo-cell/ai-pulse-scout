import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { subHours } from 'date-fns';
import type { SourceConfig } from '../types/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../../config');

const raw = yaml.load(readFileSync(join(CONFIG_DIR, 'sources.yaml'), 'utf8')) as {
  sources: SourceConfig[];
};
const all = raw.sources;
const enabled = all.filter((s) => s.enabled !== false);
const deferred = all.filter((s) => s.enabled === false);

const now = new Date();
const windowStart = subHours(now, 48);

console.log(`\nAI Pulse Scout — Source Registry Validation`);
console.log(`  Total sources:   ${all.length}`);
console.log(`  Enabled (v1):    ${enabled.length}`);
console.log(`  Deferred:        ${deferred.length}`);

// Summary of deferred reasons
const deferredByStatus: Record<string, number> = {};
for (const s of deferred) {
  const key = s.coverage_status ?? 'unknown';
  deferredByStatus[key] = (deferredByStatus[key] ?? 0) + 1;
}
console.log(`\n  Deferred breakdown:`);
for (const [status, count] of Object.entries(deferredByStatus)) {
  console.log(`    ${status.padEnd(28)} ${count}`);
}

// Enabled source types
const typeCount: Record<string, number> = {};
for (const s of enabled) {
  typeCount[s.type] = (typeCount[s.type] ?? 0) + 1;
}
console.log(`\n  Enabled by type:`);
for (const [type, count] of Object.entries(typeCount)) {
  console.log(`    ${type.padEnd(12)} ${count}`);
}

console.log(`\nFetching enabled sources (48h window)...\n`);

let ok = 0;
let failed = 0;

for (const source of enabled) {
  const result = await fetchRssSource(source, windowStart, now);
  if (result.error) {
    console.log(`  FAIL  ${source.name}: ${result.error}`);
    failed++;
  } else {
    console.log(`  OK    ${source.name} (${result.items.length} items in 48h window)`);
    ok++;
  }
}

console.log(`\n── Results ────────────────────────────────────`);
console.log(`  ${ok} OK, ${failed} failed out of ${enabled.length} enabled sources`);
if (failed > 0) {
  console.log(`  (Failures are often transient or indicate a feed URL that needs updating.)`);
  process.exit(1);
}
