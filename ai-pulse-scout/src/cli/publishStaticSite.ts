import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function runBuildSite(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli/buildStaticSite.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`build:site terminated by signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`build:site exited with code ${code ?? 'unknown'}`));
        return;
      }

      resolve();
    });
  });
}

export async function triggerDeployHook(url: string): Promise<void> {
  const response = await fetch(url, { method: 'POST' });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Deploy hook failed with status ${response.status}: ${body}`);
  }

  console.log(`Deploy hook accepted (${response.status}): ${body}`);
}

export async function main(): Promise<void> {
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!deployHookUrl) {
    throw new Error('VERCEL_DEPLOY_HOOK_URL is required for static-site autopublish');
  }

  console.log('=== AI Pulse Scout — Static Site Autopublish ===');
  console.log('Step 1/2: build static site');
  await runBuildSite();
  console.log('Step 2/2: trigger Vercel deploy hook');
  await triggerDeployHook(deployHookUrl);
  console.log('=== Done (OK) ===');
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  await main();
}
