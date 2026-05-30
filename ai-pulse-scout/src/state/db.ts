import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from './schema.js';

export type PipelineDb = Database.Database;

export function openPipelineDb(path: string): PipelineDb {
  mkdirSync(dirname(path), { recursive: true });
  return new Database(path);
}

export function initializePipelineSchema(db: PipelineDb): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrateLegacyItemsTable(db);
  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }
}

function migrateLegacyItemsTable(db: PipelineDb): void {
  const hasItems = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items'`).get() as
    | { name: string }
    | undefined;
  if (!hasItems) return;

  const columns = db.prepare(`PRAGMA table_info(items)`).all() as Array<{ name: string }>;
  const hasItemKey = columns.some((column) => column.name === 'item_key');
  if (hasItemKey) return;

  db.pragma('foreign_keys = OFF');
  db.exec(`ALTER TABLE items RENAME TO items_legacy`);
  db.exec(`CREATE TABLE items (
    item_key TEXT PRIMARY KEY,
    id TEXT NOT NULL,
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
    updated_at TEXT NOT NULL,
    UNIQUE(run_id, id)
  )`);
  db.exec(`INSERT INTO items (
    item_key, id, run_id, source_id, url, title, published_at, dedupe_key, normalized_item_json,
    content_status, enrichment_status, final_status, retry_count_fetch, retry_count_enrichment,
    priority, carry_forward_run_id, created_at, updated_at
  )
  SELECT
    run_id || ':' || id,
    id, run_id, source_id, url, title, published_at, dedupe_key, normalized_item_json,
    content_status, enrichment_status, final_status, retry_count_fetch, retry_count_enrichment,
    priority, carry_forward_run_id, created_at, updated_at
  FROM items_legacy`);

  migrateLegacyRelationTable(db, 'item_contents', 'item_id', `
    CREATE TABLE item_contents (
      item_key TEXT PRIMARY KEY,
      raw_content TEXT,
      clean_content TEXT,
      content_length INTEGER NOT NULL DEFAULT 0,
      fetch_method TEXT,
      fetch_started_at TEXT,
      fetch_completed_at TEXT,
      fetch_duration_ms INTEGER,
      fetch_error TEXT,
      FOREIGN KEY(item_key) REFERENCES items(item_key)
    )
  `, `
    INSERT INTO item_contents (
      item_key, raw_content, clean_content, content_length, fetch_method, fetch_started_at, fetch_completed_at, fetch_duration_ms, fetch_error
    )
    SELECT
      items_legacy.run_id || ':' || legacy.item_id,
      legacy.raw_content, legacy.clean_content, legacy.content_length, legacy.fetch_method, legacy.fetch_started_at,
      legacy.fetch_completed_at, legacy.fetch_duration_ms, legacy.fetch_error
    FROM item_contents_legacy legacy
    JOIN items_legacy ON items_legacy.id = legacy.item_id
  `);

  migrateLegacyRelationTable(db, 'item_enrichments', 'item_id', `
    CREATE TABLE item_enrichments (
      item_key TEXT PRIMARY KEY,
      model TEXT,
      prompt_version TEXT,
      summary TEXT,
      why_it_matters TEXT,
      topics_json TEXT NOT NULL DEFAULT '[]',
      relevance_score REAL,
      relevance_bucket TEXT,
      raw_response TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      duration_ms INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_key) REFERENCES items(item_key)
    )
  `, `
    INSERT INTO item_enrichments (
      item_key, model, prompt_version, summary, why_it_matters, topics_json,
      relevance_score, relevance_bucket, raw_response, tokens_in, tokens_out, duration_ms, created_at
    )
    SELECT
      items_legacy.run_id || ':' || legacy.item_id,
      legacy.model, legacy.prompt_version, legacy.summary, legacy.why_it_matters, legacy.topics_json,
      legacy.relevance_score, legacy.relevance_bucket, legacy.raw_response, legacy.tokens_in, legacy.tokens_out,
      legacy.duration_ms, legacy.created_at
    FROM item_enrichments_legacy legacy
    JOIN items_legacy ON items_legacy.id = legacy.item_id
  `);

  migrateLegacyRelationTable(db, 'item_attempts', 'item_id', `
    CREATE TABLE item_attempts (
      id TEXT PRIMARY KEY,
      item_key TEXT NOT NULL,
      stage TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      outcome TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY(item_key) REFERENCES items(item_key)
    )
  `, `
    INSERT INTO item_attempts (
      id, item_key, stage, attempt_number, started_at, completed_at, duration_ms, outcome, error_message
    )
    SELECT
      legacy.id,
      items_legacy.run_id || ':' || legacy.item_id,
      legacy.stage, legacy.attempt_number, legacy.started_at, legacy.completed_at, legacy.duration_ms, legacy.outcome, legacy.error_message
    FROM item_attempts_legacy legacy
    JOIN items_legacy ON items_legacy.id = legacy.item_id
  `);

  db.exec(`DROP TABLE items_legacy`);
  db.pragma('foreign_keys = ON');
}

function migrateLegacyRelationTable(
  db: PipelineDb,
  tableName: string,
  legacyColumn: string,
  createSql: string,
  copySql: string,
): void {
  const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName) as
    | { name: string }
    | undefined;
  if (!exists) return;

  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'item_key')) return;

  db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_legacy`);
  db.exec(createSql);
  db.exec(copySql);
  db.exec(`DROP TABLE ${tableName}_legacy`);
}
