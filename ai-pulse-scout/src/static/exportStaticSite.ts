import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedItem } from '../types/item.js';
import { renderStaticDayPage, renderStaticIndexPage } from './renderStaticSite.js';

export interface ExportStaticSiteInput {
  outputDir: string;
  siteTitle: string;
  targetDate: string;
  recentDays: string[];
  items: NormalizedItem[];
}

export interface ExportStaticSiteResult {
  indexPath: string;
  dayPath: string;
}

export async function exportStaticSite(input: ExportStaticSiteInput): Promise<ExportStaticSiteResult> {
  const daysDir = join(input.outputDir, 'days');
  await mkdir(daysDir, { recursive: true });

  const recentDays = Array.from(new Set([input.targetDate, ...input.recentDays]));
  const indexPath = join(input.outputDir, 'index.html');
  const dayPath = join(daysDir, `${input.targetDate}.html`);

  const indexHtml = renderStaticIndexPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    recentDays,
    items: input.items,
  });

  await writeFile(indexPath, indexHtml, 'utf8');

  for (const day of recentDays) {
    const archiveHtml = renderStaticDayPage({
      siteTitle: input.siteTitle,
      targetDate: day,
      homeHref: '../index.html',
      recentDays,
      items: day === input.targetDate ? input.items : [],
    });

    await writeFile(join(daysDir, `${day}.html`), archiveHtml, 'utf8');
  }

  return { indexPath, dayPath };
}
