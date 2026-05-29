import { loadConfig } from '../config/loadConfig.js';
import { dedupeItems } from '../filtering/dedupeItems.js';
import { selectItems } from '../filtering/selectItems.js';
import { renderHtmlEmail, buildSubject } from '../render/renderHtmlEmail.js';
import { enrichKeyInsights } from '../insights/analyzeKeyInsights.js';
import { generateExecutiveBrief } from '../insights/generateExecutiveBrief.js';
import { saveSuccessfulRun } from '../state/runState.js';
import { loadLedger, appendToLedger } from '../state/ledger.js';
import { computeDailyCutoffWindow } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import type { MailClient } from '../mail/MailClient.js';
import type { NormalizedItem } from '../types/item.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../data/output');

export interface DigestRunResult {
  subject: string;
  html: string;
  items: NormalizedItem[];
  itemCount: number;
  totalFetched: number;
  outputPath: string;
}

export async function runDailyDigest(
  mailClient: MailClient | null = null,
  sendEmail = false,
): Promise<DigestRunResult> {
  const config = loadConfig();
  const now = new Date();

  const { windowStart, windowEnd } = computeDailyCutoffWindow(now);

  logger.info(`Collection window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const ingestion = await ingestAllSources({
    sources: config.sources,
    windowStart,
    windowEnd,
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

  const ledger = loadLedger();
  const deduped = dedupeItems(allItems, ledger);
  logger.info(`After dedup: ${deduped.length} items`);

  const selected = await enrichKeyInsights(selectItems(deduped, config.digest));
  logger.info(`Selected: ${selected.length} items for digest`);

  const executiveBrief = await generateExecutiveBrief(selected);
  const subject = buildSubject(config.email.subject_template, now, selected.length);
  const html = renderHtmlEmail({
    items: selected,
    date: now,
    subjectTemplate: config.email.subject_template,
    executiveBrief,
  });

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const datePart = now.toISOString().slice(0, 10);
  const outputPath = join(OUTPUT_DIR, `digest-${datePart}.html`);
  writeFileSync(outputPath, html, 'utf8');
  logger.info(`Saved HTML artifact: ${outputPath}`);

  if (sendEmail && mailClient && selected.length > 0) {
    const fromAddr = config.email.from_address || process.env.SMTP_USER || 'pulse@example.com';
    await mailClient.send({
      to: config.email.to,
      from: `${config.email.from_name} <${fromAddr}>`,
      subject,
      html,
    });
    appendToLedger(selected);
    saveSuccessfulRun(now);
    logger.info('Ledger updated and run state saved.');
  } else if (sendEmail && selected.length === 0) {
    logger.info('No digest items selected — skipping email send and state update.');
  }

  return { subject, html, items: selected, itemCount: selected.length, totalFetched: allItems.length, outputPath };
}
