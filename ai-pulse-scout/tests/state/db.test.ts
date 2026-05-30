import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';

describe('pipeline db bootstrap', () => {
  it('creates core tables for pipeline persistence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-db-'));
    const dbPath = join(dir, 'pipeline.sqlite');

    const db = openPipelineDb(dbPath);
    initializePipelineSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining(['item_attempts', 'item_contents', 'item_enrichments', 'items', 'runs']),
    );

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
