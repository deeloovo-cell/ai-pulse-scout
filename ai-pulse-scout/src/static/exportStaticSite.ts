import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedItem } from '../types/item.js';
import { renderStaticDayPage, renderStaticIndexPage, renderStaticRecentDaysNav } from './renderStaticSite.js';

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

async function refreshExistingDayPageNav(dayPath: string, recentDays: string[]): Promise<void> {
  const html = await readFile(dayPath, 'utf8');
  const navHtml = renderStaticRecentDaysNav(recentDays, '');
  const updatedHtml = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, navHtml.trim());

  if (updatedHtml !== html) {
    await writeFile(dayPath, updatedHtml, 'utf8');
  }
}

export async function exportStaticSite(input: ExportStaticSiteInput): Promise<ExportStaticSiteResult> {
  const daysDir = join(input.outputDir, 'days');
  await mkdir(daysDir, { recursive: true });

  const recentDays = Array.from(new Set(input.recentDays));
  const indexPath = join(input.outputDir, 'index.html');
  const dayPath = join(daysDir, `${input.targetDate}.html`);

  const indexHtml = renderStaticIndexPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    recentDays,
    items: input.items,
  });

  const dayHtml = renderStaticDayPage({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    homeHref: '../index.html',
    recentDays,
    items: input.items,
  });

  await writeFile(indexPath, indexHtml, 'utf8');
  await writeFile(dayPath, dayHtml, 'utf8');

  const keepDays = new Set(recentDays);
  const dayFiles = await readdir(daysDir);
  await Promise.all(
    dayFiles
      .filter((file) => file.endsWith('.html'))
      .filter((file) => keepDays.has(file.replace(/\.html$/, '')))
      .map((file) => refreshExistingDayPageNav(join(daysDir, file), recentDays)),
  );

  await Promise.all(
    dayFiles
      .filter((file) => file.endsWith('.html'))
      .filter((file) => !keepDays.has(file.replace(/\.html$/, '')))
      .map((file) => rm(join(daysDir, file), { force: true })),
  );

  return { indexPath, dayPath };
}
