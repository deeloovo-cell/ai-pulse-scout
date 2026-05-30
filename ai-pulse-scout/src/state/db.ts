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
  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }
}
