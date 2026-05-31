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

  const indexPath = join(input.outputDir, 'index.html');
  const dayPath = join(daysDir, `${input.targetDate}.html`);

  const indexHtml = renderStaticIndexPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    recentDays: input.recentDays,
    items: input.items,
  });

  const dayHtml = renderStaticDayPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    homeHref: '../index.html',
    items: input.items,
  });

  await writeFile(indexPath, indexHtml, 'utf8');
  await writeFile(dayPath, dayHtml, 'utf8');

  return { indexPath, dayPath };
}
