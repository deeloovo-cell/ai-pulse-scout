import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, '../../data/state/last_successful_run.json');

export interface RunState {
  last_successful_run: string | null;  // ISO timestamp
  run_count: number;
}

function ensureDir(): void {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadRunState(): RunState {
  ensureDir();
  if (!existsSync(STATE_PATH)) {
    return { last_successful_run: null, run_count: 0 };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as RunState;
  } catch {
    return { last_successful_run: null, run_count: 0 };
  }
}

export function saveSuccessfulRun(runAt: Date): void {
  ensureDir();
  const current = loadRunState();
  const updated: RunState = {
    last_successful_run: runAt.toISOString(),
    run_count: current.run_count + 1,
  };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2), 'utf8');
}
