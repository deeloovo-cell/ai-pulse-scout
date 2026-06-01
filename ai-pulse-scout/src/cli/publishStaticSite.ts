import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  resolveStaticSitePublishWindow,
  writeStaticSitePublishCheckpoint,
} from '../state/staticSitePublishCheckpoint.js';

function runCommand(command: string, args: string[], cwd: string, envOverrides: Record<string, string> = {}): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...envOverrides },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
        return;
      }

      resolvePromise();
    });
  });
}

export async function runBuildSite({ windowStartIso, windowEndIso }: { windowStartIso: string; windowEndIso: string }): Promise<void> {
  await runCommand(
    process.execPath,
    ['--import', 'tsx', 'src/cli/buildStaticSite.ts'],
    process.cwd(),
    {
      STATIC_SITE_WINDOW_START: windowStartIso,
      STATIC_SITE_WINDOW_END: windowEndIso,
    },
  );
}

export async function deployGeneratedSite(): Promise<void> {
  const projectDir = process.cwd();
  const deployScript = resolve(projectDir, 'scripts/deploy-static-site.sh');
  await runCommand('bash', [deployScript], projectDir);
}

export async function main(): Promise<void> {
  const projectDir = process.cwd();
  const checkpointPath = resolve(projectDir, 'data/state/static-site-publish-checkpoint.json');
  const runStartedAt = new Date();
  const resolved = resolveStaticSitePublishWindow({ checkpointPath, runStartedAt });

  console.log('=== AI Pulse Scout — Static Site Autopublish ===');
  console.log(`Run started at: ${runStartedAt.toISOString()}`);
  console.log(`Window source: ${resolved.source}`);
  console.log(`Window start: ${resolved.windowStart.toISOString()}`);
  console.log(`Window end:   ${resolved.windowEnd.toISOString()}`);
  console.log('Step 1/2: build static site');
  await runBuildSite({
    windowStartIso: resolved.windowStart.toISOString(),
    windowEndIso: resolved.windowEnd.toISOString(),
  });
  console.log('Step 2/2: deploy generated static site');
  await deployGeneratedSite();

  const completedAt = new Date();
  writeStaticSitePublishCheckpoint(checkpointPath, {
    lastSuccessfulFetchCompletedAt: completedAt.toISOString(),
    runStartedAt: runStartedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  });
  console.log(`Checkpoint updated: ${completedAt.toISOString()}`);
  console.log('=== Done (OK) ===');
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  await main();
}
