import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { openPipelineDb, initializePipelineSchema } from '../../src/state/db.js';

describe('db relation migration', () => {
  it('upgrades legacy related tables to item_key-based foreign keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ai-pulse-db-rel-migration-'));
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
    );
    CREATE TABLE item_contents (
      item_id TEXT PRIMARY KEY,
      raw_content TEXT,
      clean_content TEXT,
      content_length INTEGER NOT NULL DEFAULT 0,
      fetch_method TEXT,
      fetch_started_at TEXT,
      fetch_completed_at TEXT,
      fetch_duration_ms INTEGER,
      fetch_error TEXT
    );
    INSERT INTO items VALUES ('item-1', 'run-1', 'source-1', 'https://a', 'A', NULL, 'dedupe-1', NULL, 'done', 'pending', 'pending', 0, 0, 0, NULL, '2026-05-30T07:00:00.000Z', '2026-05-30T07:00:00.000Z');
    INSERT INTO item_contents VALUES ('item-1', 'raw', 'clean', 5, 'test', NULL, '2026-05-30T07:00:01.000Z', 10, NULL);
    `);
    legacy.close();

    const db = openPipelineDb(path);
    initializePipelineSchema(db);

    const columns = db.prepare(`PRAGMA table_info(item_contents)`).all() as Array<{ name: string }>;
    const migrated = db.prepare(`SELECT item_key FROM item_contents`).get() as { item_key: string };

    expect(columns.some((column) => column.name === 'item_key')).toBe(true);
    expect(migrated.item_key).toBe('run-1:item-1');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
