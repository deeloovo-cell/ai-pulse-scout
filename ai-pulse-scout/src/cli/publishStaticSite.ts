import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
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

export async function runBuildSite(): Promise<void> {
  await runCommand(process.execPath, ['--import', 'tsx', 'src/cli/buildStaticSite.ts'], process.cwd());
}

export async function deployGeneratedSite(): Promise<void> {
  const projectDir = process.cwd();
  const deployScript = resolve(projectDir, 'scripts/deploy-static-site.sh');
  await runCommand('bash', [deployScript], projectDir);
}

export async function main(): Promise<void> {
  console.log('=== AI Pulse Scout — Static Site Autopublish ===');
  console.log('Step 1/2: build static site');
  await runBuildSite();
  console.log('Step 2/2: deploy generated static site');
  await deployGeneratedSite();
  console.log('=== Done (OK) ===');
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  await main();
}
