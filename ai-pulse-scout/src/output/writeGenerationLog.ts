import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceIngestionResult } from '../ingest/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_GENERATION_LOG_DIR = join(__dirname, '../../data/logs');

export interface GenerationLogItem {
  title: string;
  url: string;
  sourceName?: string;
}

export interface GenerationLogInput {
  date: string;
  generatedAt: Date;
  subject?: string;
  windowStart?: Date;
  windowEnd?: Date;
  ingestionResults: SourceIngestionResult[];
  publishedItems: GenerationLogItem[];
  published?: boolean;
}

export interface SourceStatRow {
  sourceName: string;
  sourceUrl: string;
  raw: number;
  capped: number;
  inDigest: number;
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

export function buildSourceStats(
  ingestionResults: SourceIngestionResult[],
  publishedItems: GenerationLogItem[],
): SourceStatRow[] {
  const digestCounts = new Map<string, number>();
  for (const item of publishedItems) {
    const key = item.sourceName ?? 'Unknown';
    digestCounts.set(key, (digestCounts.get(key) ?? 0) + 1);
  }

  return ingestionResults
    .map((result) => ({
      sourceName: result.source.name,
      sourceUrl: result.source.url,
      raw: result.diagnostics.attempted,
      capped: result.items.length,
      inDigest: digestCounts.get(result.source.name) ?? 0,
    }))
    .sort((left, right) => {
      if (right.capped !== left.capped) return right.capped - left.capped;
      return left.sourceName.localeCompare(right.sourceName);
    });
}

export function formatGenerationLog(input: GenerationLogInput): string {
  const stats = buildSourceStats(input.ingestionResults, input.publishedItems);
  const totalRaw = stats.reduce((sum, row) => sum + row.raw, 0);
  const totalCapped = stats.reduce((sum, row) => sum + row.capped, 0);
  const lines: string[] = [
    '# AI Pulse Scout — Content Generation Log',
    '',
    `**Date:** ${input.date}`,
    `**Generated at:** ${input.generatedAt.toISOString()}`,
  ];

  if (input.subject) {
    lines.push(`**Subject:** ${input.subject}`);
  }

  if (input.windowStart && input.windowEnd) {
    lines.push(`**Collection window:** ${input.windowStart.toISOString()} → ${input.windowEnd.toISOString()}`);
  }

  lines.push(
    `**Published:** ${input.published === false ? 'no' : 'yes'}`,
    `**Digest items:** ${input.publishedItems.length}`,
    '',
    '## Source statistics',
    '',
    '| Source | Raw | Capped | In digest |',
    '| --- | ---: | ---: | ---: |',
  );

  for (const row of stats) {
    lines.push(`| ${row.sourceName} | ${row.raw} | ${row.capped} | ${row.inDigest} |`);
  }

  lines.push(
    `| **Total** | **${totalRaw}** | **${totalCapped}** | **${input.publishedItems.length}** |`,
    '',
    '## Published items',
    '',
  );

  if (input.publishedItems.length === 0) {
    lines.push('_No items published._', '');
  } else {
    input.publishedItems.forEach((item, index) => {
      const title = escapeMarkdownLinkText(item.title);
      const suffix = item.sourceName ? ` — ${item.sourceName}` : '';
      lines.push(`${index + 1}. [${title}](${item.url})${suffix}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function writeGenerationLog(
  input: GenerationLogInput,
  outputDir: string = DEFAULT_GENERATION_LOG_DIR,
): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const logPath = join(outputDir, `generation-${input.date}.md`);
  writeFileSync(logPath, formatGenerationLog(input), 'utf8');
  return logPath;
}
