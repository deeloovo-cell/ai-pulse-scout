import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';
import { loadConfig } from '../config/loadConfig.js';
import { dedupeItems } from '../filtering/dedupeItems.js';
import { selectItems } from '../filtering/selectItems.js';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { renderHtmlEmail, buildSubject } from '../render/renderHtmlEmail.js';
import { enrichKeyInsights } from '../insights/analyzeKeyInsights.js';
import { generateExecutiveBrief } from '../insights/generateExecutiveBrief.js';
import { loadLedger, appendToLedger } from '../state/ledger.js';
import { computeBackfillWindowStart } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import type { MailClient } from '../mail/MailClient.js';
import type { NormalizedItem } from '../types/item.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../data/output');

// Allow more items in a backfill digest than a normal daily run
const BACKFILL_MAX_ITEMS = 20;

export interface BackfillOptions {
  days: number;   // lookback window in days
  send: boolean;  // true → real SMTP send + update ledger; false → preview only
}

export interface BackfillResult {
  subject: string;
  html: string;
  items: NormalizedItem[];
  itemCount: number;
  outputPath: string;
  windowStart: Date;
}

export async function runBackfill(
  mailClient: MailClient | null,
  options: BackfillOptions,
): Promise<BackfillResult> {
  const config = loadConfig();
  const now = new Date();
  const windowStart = computeBackfillWindowStart(options.days);

  logger.info(`Backfill window: ${windowStart.toISOString()} → ${now.toISOString()} (${options.days} days)`);

  const ingestion = await ingestAllSources({
    sources: config.sources,
    windowStart,
    windowEnd: now,
    adapters: [
      new FeedAdapter(),
      new GenericWebAdapter(),
      new YouTubeAdapter(),
      new GitHubAdapter(),
      new DocsAdapter(),
      new CommunityAdapter(),
      new PapersAdapter(),
    ],
  });
  const allItems = ingestion.items;
  logger.info(`Unified ingestion fetched ${allItems.length} items across ${ingestion.summary.totalSources} sources`);
  logger.info(`Support summary: ${JSON.stringify(ingestion.summary.byStatus)}`);
  for (const result of ingestion.results) {
    logger.info(
      `Source ${result.source.name}: raw=${result.diagnostics.attempted} aiAccepted=${result.diagnostics.aiAccepted ?? 0} aiRejected=${result.diagnostics.aiRejected ?? 0} capped=${result.diagnostics.capped ?? result.items.length}`,
    );
  }

  // Preview: use empty ledger so all historical items are visible.
  // Send: check real ledger to avoid re-sending items already delivered.
  const ledger = options.send ? loadLedger() : new Set<string>();
  const deduped = dedupeItems(allItems, ledger);
  logger.info(`After dedup: ${deduped.length} items`);

  const backfillDigestConfig = {
    ...config.digest,
    max_items: Math.max(config.digest.max_items, BACKFILL_MAX_ITEMS),
  };

  const selected = await enrichKeyInsights(selectItems(deduped, backfillDigestConfig));
  logger.info(`Selected: ${selected.length} items for backfill digest`);

  const executiveBrief = await generateExecutiveBrief(selected);
  const baseSubject = buildSubject(config.email.subject_template, now, selected.length);
  const subject = `[BACKFILL ${options.days}d] ${baseSubject}`;
  const html = renderHtmlEmail({
    items: selected,
    date: now,
    subjectTemplate: config.email.subject_template,
    executiveBrief,
  });

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const datePart = now.toISOString().slice(0, 10);
  const outputPath = join(OUTPUT_DIR, `digest-backfill-${datePart}-${options.days}d.html`);
  writeFileSync(outputPath, html, 'utf8');
  logger.info(`Saved backfill HTML artifact: ${outputPath}`);

  if (options.send && mailClient && selected.length > 0) {
    const fromAddr = config.email.from_address || process.env.SMTP_USER || 'pulse@example.com';
    await mailClient.send({
      to: config.email.to,
      from: `${config.email.from_name} <${fromAddr}>`,
      subject,
      html,
    });
    // Mark sent items in ledger so they won't be re-sent; do NOT advance last_successful_run.
    appendToLedger(selected);
    logger.info('Ledger updated (last_successful_run NOT advanced — daily cadence preserved).');
  } else if (options.send && selected.length === 0) {
    logger.info('No backfill items selected — skipping email send and ledger update.');
  }

  return { subject, html, items: selected, itemCount: selected.length, outputPath, windowStart };
}
