import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedItem } from '../types/item.js';
import { renderStaticIndexPage } from './renderStaticSite.js';

export interface ExportStaticSiteInput {
  outputDir: string;
  siteTitle: string;
  targetDate: string;
  items: NormalizedItem[];
}

export interface ExportStaticSiteResult {
  indexPath: string;
}

export async function exportStaticSite(input: ExportStaticSiteInput): Promise<ExportStaticSiteResult> {
  const daysDir = join(input.outputDir, 'days');
  await mkdir(input.outputDir, { recursive: true });
  await rm(daysDir, { recursive: true, force: true });

  const indexPath = join(input.outputDir, 'index.html');
  const indexHtml = renderStaticIndexPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    items: input.items,
  });

  await writeFile(indexPath, indexHtml, 'utf8');

  return { indexPath };
}
