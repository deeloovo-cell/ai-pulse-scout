import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSourceUniverse } from '../inbox/buildSourceUniverse.js';
import { summarizeCoverage } from '../inbox/coverageReport.js';
import { runSourceCoverage } from '../jobs/runSourceCoverage.js';

const markdown = readFileSync('config/source-inbox.md', 'utf8');
const universe = buildSourceUniverse(markdown);
const results = await runSourceCoverage(universe);
const summary = summarizeCoverage(results);

mkdirSync('data/output/source-coverage', { recursive: true });
writeFileSync(
  join('data/output/source-coverage', 'latest.json'),
  JSON.stringify({ summary, results }, null, 2),
  'utf8',
);

console.log('AI Pulse Scout — Source Coverage');
console.log(JSON.stringify(summary, null, 2));
