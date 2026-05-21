import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { SourceConfig } from '../src/types/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcesYaml = join(__dirname, '../config/sources.yaml');

interface SourcesFile {
  sources: SourceConfig[];
}

function loadSources(): SourceConfig[] {
  const raw = readFileSync(sourcesYaml, 'utf8');
  const parsed = yaml.load(raw) as SourcesFile;
  return parsed.sources;
}

const VALID_TYPES = ['rss', 'atom', 'youtube', 'podcast', 'github'] as const;
const VALID_STATUSES = [
  'live',
  'deferred_youtube',
  'deferred_podcast',
  'deferred_social',
  'deferred_no_feed',
  'deferred_github_watch',
] as const;

describe('sources.yaml schema', () => {
  it('parses without error and has entries', () => {
    const sources = loadSources();
    expect(sources.length).toBeGreaterThan(0);
  });

  it('all entries have required fields: name, category, url, type', () => {
    const sources = loadSources();
    for (const s of sources) {
      expect(s.name, `name missing on ${JSON.stringify(s)}`).toBeTruthy();
      expect(s.category, `category missing on ${s.name}`).toBeTruthy();
      expect(s.url, `url missing on ${s.name}`).toBeTruthy();
      expect(VALID_TYPES).toContain(s.type as string);
    }
  });

  it('all entries with coverage_status use a valid value', () => {
    const sources = loadSources();
    for (const s of sources) {
      if (s.coverage_status != null) {
        expect(VALID_STATUSES, `invalid coverage_status on ${s.name}`).toContain(
          s.coverage_status as string,
        );
      }
    }
  });

  it('enabled sources all have coverage_status: live', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    for (const s of enabled) {
      expect(s.coverage_status, `enabled source "${s.name}" should have coverage_status: live`).toBe(
        'live',
      );
    }
  });

  it('deferred sources all have enabled: false', () => {
    const sources = loadSources();
    const deferred = sources.filter(
      (s) => s.coverage_status && s.coverage_status !== 'live',
    );
    for (const s of deferred) {
      expect(s.enabled, `deferred source "${s.name}" must have enabled: false`).toBe(false);
    }
  });

  it('has at least 30 enabled sources', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    expect(enabled.length).toBeGreaterThanOrEqual(30);
  });

  it('has at least 20 deferred sources', () => {
    const sources = loadSources();
    const deferred = sources.filter((s) => s.enabled === false);
    expect(deferred.length).toBeGreaterThanOrEqual(20);
  });

  it('no two sources share the same url among enabled entries', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    const urls = enabled.map((s) => s.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it('enabled sources cover expected categories', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    const cats = new Set(enabled.map((s) => s.category));
    expect(cats.has('ai_engineering')).toBe(true);
    expect(cats.has('research')).toBe(true);
    expect(cats.has('industrial_ai')).toBe(true);
    expect(cats.has('ai_news')).toBe(true);
    expect(cats.has('open_source')).toBe(true);
  });
});

describe('loadConfig source filtering', () => {
  it('filters out disabled sources', () => {
    const all = loadSources();
    const enabled = all.filter((s) => s.enabled !== false);
    const disabled = all.filter((s) => s.enabled === false);
    expect(enabled.length).toBeGreaterThan(0);
    expect(disabled.length).toBeGreaterThan(0);
    expect(enabled.length + disabled.length).toBe(all.length);
  });
});
