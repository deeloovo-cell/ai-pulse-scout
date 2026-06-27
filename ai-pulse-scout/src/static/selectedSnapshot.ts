import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { NormalizedItem } from '../types/item.js';

export function defaultSelectedSnapshotPath(outputDir: string, digestDate: string): string {
  return join(outputDir, `selected-${digestDate}.json`);
}

export async function writeSelectedSnapshot(path: string, items: NormalizedItem[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(items, null, 2), 'utf8');
}

export async function readSelectedSnapshot(path: string): Promise<NormalizedItem[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed.map(reviveNormalizedItem);
}

function reviveNormalizedItem(raw: Record<string, unknown>): NormalizedItem {
  return {
    ...(raw as unknown as NormalizedItem),
    published_at: typeof raw.published_at === 'string' ? new Date(raw.published_at) : null,
    fetched_at: new Date(String(raw.fetched_at)),
  };
}
