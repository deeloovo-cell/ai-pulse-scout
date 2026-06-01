import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { computeAutoDeployDigestDate, defaultStaticSiteOutputDir } from '../static/exportStaticSiteCli.js';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

const targetDate = computeAutoDeployDigestDate();
const outputDir = defaultStaticSiteOutputDir();
const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const exportCliPath = resolve(currentDir, 'exportStaticSite.ts');
const windowStartIso = readEnv('STATIC_SITE_WINDOW_START');
const windowEndIso = readEnv('STATIC_SITE_WINDOW_END');
const args = ['--import', 'tsx', exportCliPath, '--date', targetDate, '--output-dir', outputDir];

if (windowStartIso && windowEndIso) {
  args.push('--window-start', windowStartIso, '--window-end', windowEndIso);
}

console.log(`Auto-selected digest date: ${targetDate}`);
console.log(`Output dir: ${outputDir}`);
if (windowStartIso && windowEndIso) {
  console.log(`Window override: ${windowStartIso} -> ${windowEndIso}`);
}

const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`build:site terminated by signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
