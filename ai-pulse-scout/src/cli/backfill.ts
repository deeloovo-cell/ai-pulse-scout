import 'dotenv/config';
import { runBackfill } from '../jobs/runBackfill.js';
import { SmtpMailClient, smtpConfigFromEnv } from '../mail/SmtpMailClient.js';
import { logger } from '../utils/logger.js';

// Parse CLI args: --days N  --send
const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days = daysIdx !== -1 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 7;
const wantSend = args.includes('--send');

if (isNaN(days) || days < 1) {
  console.error('Error: --days must be a positive integer (e.g. --days 7)');
  process.exit(1);
}

logger.info(`=== AI Pulse Scout — Backfill Mode (${days} days) ===`);
if (wantSend) {
  logger.info('--send flag active: will attempt SMTP send and update ledger');
} else {
  logger.info('Preview mode (no --send): no email sent, no state updates');
}

const smtpConfig = smtpConfigFromEnv();
let mailClient: SmtpMailClient | null = null;
let willSend = false;

if (wantSend) {
  if (!smtpConfig.user || !smtpConfig.pass) {
    logger.warn('SMTP_USER or SMTP_PASS not set — cannot send. Running preview instead.');
  } else {
    mailClient = new SmtpMailClient(smtpConfig);
    willSend = true;
  }
}

try {
  const result = await runBackfill(mailClient, { days, send: willSend });
  console.log('\n---');
  console.log(`Subject:  ${result.subject}`);
  console.log(`Window:   ${result.windowStart.toISOString().slice(0, 10)} → now (${days} days)`);
  console.log(`Items:    ${result.itemCount}`);
  console.log(`Output:   ${result.outputPath}`);
  if (willSend) {
    console.log('Email sent. Ledger updated; last_successful_run unchanged.');
  } else {
    console.log('Preview complete — no email sent, no state updated.');
  }
  if (result.itemCount === 0) {
    console.log('\n[!] No items found in the backfill window.');
    console.log('    Check feed activity or increase the --days lookback window.');
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(`Backfill failed: ${msg}`);
  process.exit(1);
}
