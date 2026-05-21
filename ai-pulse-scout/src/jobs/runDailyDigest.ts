import { loadConfig } from '../config/loadConfig.js';
import { fetchAllSources } from '../fetchers/rssFetcher.js';
import { scoreItems } from '../filtering/scoreItem.js';
import { dedupeItems } from '../filtering/dedupeItems.js';
import { selectItems } from '../filtering/selectItems.js';
import { renderHtmlEmail, buildSubject } from '../render/renderHtmlEmail.js';
import { loadRunState, saveSuccessfulRun } from '../state/runState.js';
import { loadLedger, appendToLedger } from '../state/ledger.js';
import { computeWindowStart } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import type { MailClient } from '../mail/MailClient.js';
import type { NormalizedItem } from '../types/item.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../data/output');

export interface DigestRunResult {
  subject: string;
  html: string;
  items: NormalizedItem[];
  itemCount: number;
  outputPath: string;
}

export async function runDailyDigest(
  mailClient: MailClient | null,
  sendEmail: boolean,
): Promise<DigestRunResult> {
  const config = loadConfig();
  const runState = loadRunState();
  const now = new Date();

  const lastRun = runState.last_successful_run ? new Date(runState.last_successful_run) : null;
  const windowStart = computeWindowStart(lastRun, config.digest.collection_window_hours, config.digest.safety_buffer_hours);

  logger.info(`Collection window: ${windowStart.toISOString()} → ${now.toISOString()}`);

  const fetchResults = await fetchAllSources(config.sources, windowStart, now);
  const allItems = fetchResults.flatMap((r) => r.items);
  logger.info(`Total fetched: ${allItems.length} items`);

  const ledger = loadLedger();
  const deduped = dedupeItems(allItems, ledger);
  logger.info(`After dedup: ${deduped.length} items`);

  const scored = scoreItems(deduped, config.scoring);
  const selected = selectItems(scored, config.digest);
  logger.info(`Selected: ${selected.length} items for digest`);

  const subject = buildSubject(config.email.subject_template, now);
  const html = renderHtmlEmail({ items: selected, date: now, subjectTemplate: config.email.subject_template });

  // Save artifact
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

  return { subject, html, items: selected, itemCount: selected.length, outputPath };
}
