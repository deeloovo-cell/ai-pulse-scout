import { describe, expect, it } from 'vitest';
import type { SourceIngestionResult } from '../../src/ingest/types.js';
import {
  buildSourceStats,
  formatGenerationLog,
  writeGenerationLog,
} from '../../src/output/writeGenerationLog.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeIngestionResult(
  name: string,
  url: string,
  raw: number,
  capped: number,
): SourceIngestionResult {
  return {
    source: { name, url, type: 'feed', category: 'ai_engineering', enabled: true },
    status: 'production_supported',
    items: Array.from({ length: capped }, (_, index) => ({
      source_name: name,
      title: `Item ${index + 1}`,
      item_url: `https://example.com/${index + 1}`,
    })) as SourceIngestionResult['items'],
    diagnostics: {
      attempted: raw,
      normalized: raw,
      dropped: Math.max(raw - capped, 0),
      capped,
    },
  };
}

describe('writeGenerationLog', () => {
  it('formats source statistics and linked titles', () => {
    const markdown = formatGenerationLog({
      date: '2026-06-27',
      generatedAt: new Date('2026-06-27T07:00:00.000Z'),
      subject: 'AI Pulse — 2 items',
      windowStart: new Date('2026-06-26T07:00:00.000Z'),
      windowEnd: new Date('2026-06-27T07:00:00.000Z'),
      ingestionResults: [
        makeIngestionResult('OpenAI Blog', 'https://openai.com/blog/rss', 5, 3),
        makeIngestionResult('Anthropic News', 'https://anthropic.com/news/rss', 2, 1),
      ],
      publishedItems: [
        {
          title: 'New model release',
          url: 'https://openai.com/blog/new-model',
          sourceName: 'OpenAI Blog',
        },
        {
          title: 'Safety update [draft]',
          url: 'https://anthropic.com/news/safety',
          sourceName: 'Anthropic News',
        },
      ],
    });

    expect(markdown).toContain('| OpenAI Blog | 5 | 3 | 1 |');
    expect(markdown).toContain('| Anthropic News | 2 | 1 | 1 |');
    expect(markdown).toContain('| **Total** | **7** | **4** | **2** |');
    expect(markdown).toContain('[New model release](https://openai.com/blog/new-model) — OpenAI Blog');
    expect(markdown).toContain('[Safety update \\[draft\\]](https://anthropic.com/news/safety) — Anthropic News');
  });

  it('builds digest counts even when a source had zero capped items', () => {
    const stats = buildSourceStats(
      [makeIngestionResult('Empty Feed', 'https://example.com/feed', 0, 0)],
      [],
    );

    expect(stats).toEqual([
      {
        sourceName: 'Empty Feed',
        sourceUrl: 'https://example.com/feed',
        raw: 0,
        capped: 0,
        inDigest: 0,
      },
    ]);
  });

  it('writes a dated markdown file under the output directory', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'generation-log-'));
    const logPath = writeGenerationLog(
      {
        date: '2026-06-27',
        generatedAt: new Date('2026-06-27T07:00:00.000Z'),
        ingestionResults: [makeIngestionResult('Test Feed', 'https://example.com/feed', 1, 1)],
        publishedItems: [{ title: 'Hello', url: 'https://example.com/hello', sourceName: 'Test Feed' }],
      },
      outputDir,
    );

    expect(logPath).toBe(join(outputDir, 'generation-2026-06-27.md'));
    expect(readFileSync(logPath, 'utf8')).toContain('## Published items');
  });
});
