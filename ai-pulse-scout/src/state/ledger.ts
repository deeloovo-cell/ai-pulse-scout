import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { NormalizedItem } from '../types/item.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = join(__dirname, '../../data/state/sent_ledger.jsonl');

export interface LedgerEntry {
  fingerprint: string;
  stableIdentity?: string;
  url: string;
  title: string;
  sent_at: string;
}

function ensureDir(): void {
  const dir = dirname(LEDGER_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadLedger(): Set<string> {
  ensureDir();
  if (!existsSync(LEDGER_PATH)) return new Set();
  const lines = readFileSync(LEDGER_PATH, 'utf8').split('\n').filter(Boolean);
  const seen = new Set<string>();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LedgerEntry;
      if (entry.stableIdentity) seen.add(entry.stableIdentity);
      seen.add(entry.fingerprint);
      seen.add(normalizeUrl(entry.url));
    } catch {
      // malformed line — skip
    }
  }
  return seen;
}

export function appendToLedger(items: NormalizedItem[]): void {
  ensureDir();
  const now = new Date().toISOString();
  for (const item of items) {
    const entry: LedgerEntry = {
      fingerprint: item.fingerprint,
      stableIdentity: item.stableIdentity,
      url: item.item_url,
      title: item.title,
      sent_at: now,
    };
    appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8');
  }
}

export function isInLedger(item: NormalizedItem, seen: Set<string>): boolean {
  return seen.has(item.stableIdentity ?? item.fingerprint) || seen.has(item.fingerprint) || seen.has(normalizeUrl(item.item_url));
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, '');
}
