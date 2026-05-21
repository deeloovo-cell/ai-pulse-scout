import 'dotenv/config';
import { loadConfig } from '../config/loadConfig.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { subHours } from 'date-fns';

const config = loadConfig();
const now = new Date();
const windowStart = subHours(now, 48);

console.log(`Validating ${config.sources.length} sources...\n`);

let ok = 0;
let failed = 0;

for (const source of config.sources) {
  const result = await fetchRssSource(source, windowStart, now);
  if (result.error) {
    console.log(`  FAIL  ${source.name}: ${result.error}`);
    failed++;
  } else {
    console.log(`  OK    ${source.name} (${result.items.length} items in 48h window)`);
    ok++;
  }
}

console.log(`\n${ok} OK, ${failed} failed`);
if (failed > 0) process.exit(1);
