import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { SourceConfig } from '../src/types/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcesYaml = join(__dirname, '../config/sources.yaml');
const sourceInbox = join(__dirname, '../config/source-inbox.md');

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

function loadInboxUrls(): string[] {
  const raw = readFileSync(sourceInbox, 'utf8');
  return [...raw.matchAll(/https?:\/\/\S+/g)].map((match) => match[0]);
}

function isTraceableToInbox(source: SourceConfig, inboxUrls: string[]): boolean {
  return inboxUrls.includes(source.url) || inboxUrls.some((url) => source.notes?.includes(url));
}

function sourcesCoverInboxUrl(sources: SourceConfig[], inboxUrl: string): boolean {
  return sources.some((source) => source.url === inboxUrl || source.notes?.includes(inboxUrl));
}

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

  it('covers every inbox URL with at least one live registry source', () => {
    const sources = loadSources();
    const inboxUrls = loadInboxUrls();
    const enabled = sources.filter((s) => s.enabled !== false);

    for (const inboxUrl of inboxUrls) {
      expect(enabled, `missing enabled registry source derived from ${inboxUrl}`).toSatisfy(
        (registry: SourceConfig[]) => sourcesCoverInboxUrl(registry, inboxUrl),
      );
    }
  });

  it('keeps every enabled registry source traceable to source-inbox.md', () => {
    const sources = loadSources();
    const inboxUrls = loadInboxUrls();
    const enabled = sources.filter((s) => s.enabled !== false);

    for (const source of enabled) {
      expect(
        isTraceableToInbox(source, inboxUrls),
        `enabled source "${source.name}" is not traceable to source-inbox.md`,
      ).toBe(true);
    }
  });

  it('expands the arXiv inbox entry into canonical AI-category RSS feeds', () => {
    const sources = loadSources();
    const arxivSources = sources.filter((s) => s.notes?.includes('https://arxiv.org/'));

    expect(arxivSources.length).toBeGreaterThan(0);
    expect(arxivSources.every((s) => s.url.startsWith('https://arxiv.org/rss/'))).toBe(true);
  });

  it('covers core AI arXiv categories', () => {
    const categories = loadSources().map((s) => s.url.replace('https://arxiv.org/rss/', ''));
    for (const expected of [
      'cs.AI',
      'cs.LG',
      'cs.CL',
      'cs.CV',
      'cs.NE',
      'cs.MA',
      'cs.IR',
      'cs.RO',
      'cs.HC',
      'cs.SI',
      'stat.ML',
    ]) {
      expect(categories, `missing ${expected}`).toContain(expected);
    }
  });

  it('covers robotics, physical AI, CAD/CAM, sim-to-real, and manufacturing categories', () => {
    const categories = loadSources().map((s) => s.url.replace('https://arxiv.org/rss/', ''));
    for (const expected of ['cs.RO', 'cs.CE', 'cs.CG', 'cs.GR', 'cs.SY', 'eess.IV']) {
      expect(categories, `missing ${expected}`).toContain(expected);
    }
  });

  it('includes partial enterprise AI coverage categories', () => {
    const categories = loadSources().map((s) => s.url.replace('https://arxiv.org/rss/', ''));
    expect(categories).toContain('cs.CY');
    expect(categories).toContain('cs.SE');
  });

  it('no two sources share the same url among enabled entries', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    const urls = enabled.map((s) => s.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it('enabled sources are live RSS sources across blog and research categories', () => {
    const sources = loadSources();
    const enabled = sources.filter((s) => s.enabled !== false);
    const cats = new Set(enabled.map((s) => s.category));
    expect(cats).toEqual(new Set(['blog', 'research']));
    expect(enabled.every((s) => s.type === 'rss')).toBe(true);
  });
});

describe('loadConfig source filtering', () => {
  it('loads enabled live RSS sources for digest runs', () => {
    const all = loadSources();
    const enabled = all.filter((s) => s.enabled !== false);
    // Some sources may be disabled (e.g. blocked, broken feed) — just ensure
    // there is a meaningful pool and every enabled source is coverage_status: live.
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.length).toBeLessThanOrEqual(all.length);
    expect(enabled.every((s) => s.coverage_status === 'live')).toBe(true);
  });

  it('disabled sources use a deferred coverage_status', () => {
    const all = loadSources();
    const disabled = all.filter((s) => s.enabled === false);
    const deferredStatuses = ['deferred_youtube', 'deferred_podcast', 'deferred_social', 'deferred_no_feed', 'deferred_github_watch'];
    for (const s of disabled) {
      expect(deferredStatuses, `disabled source "${s.name}" must have a deferred coverage_status`).toContain(s.coverage_status);
    }
  });
});
