import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { computeAutoDeployDigestDate, defaultStaticSiteOutputDir } from '../static/exportStaticSiteCli.js';

const targetDate = computeAutoDeployDigestDate();
const outputDir = defaultStaticSiteOutputDir();
const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const exportCliPath = resolve(currentDir, 'exportStaticSite.ts');

console.log(`Auto-selected digest date: ${targetDate}`);
console.log(`Output dir: ${outputDir}`);

const child = spawn(
  process.execPath,
  ['--import', 'tsx', exportCliPath, '--date', targetDate, '--output-dir', outputDir],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`build:site terminated by signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
