import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';

describe('db schema migration', () => {
  it('upgrades an older items table to include item_key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-db-migration-'));
    const path = join(dir, 'pipeline.sqlite');
    const legacy = new Database(path);

    legacy.exec(`CREATE TABLE items (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT,
      dedupe_key TEXT NOT NULL,
      normalized_item_json TEXT,
      content_status TEXT NOT NULL,
      enrichment_status TEXT NOT NULL,
      final_status TEXT NOT NULL,
      retry_count_fetch INTEGER NOT NULL DEFAULT 0,
      retry_count_enrichment INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 0,
      carry_forward_run_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    legacy.close();

    const db = openPipelineDb(path);
    initializePipelineSchema(db);

    const columns = db.prepare(`PRAGMA table_info(items)`).all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === 'item_key')).toBe(true);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
