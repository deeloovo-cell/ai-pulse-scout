import 'dotenv/config';
import { runDailyDigest } from '../jobs/runDailyDigest.js';
import { SmtpMailClient, smtpConfigFromEnv } from '../mail/SmtpMailClient.js';
import { logger } from '../utils/logger.js';

logger.info('=== AI Pulse Scout — Send Test ===');

const isDryRun = process.env.DRY_RUN === 'true';
if (isDryRun) {
  logger.info('DRY_RUN=true — will generate digest but skip SMTP send');
}

const smtpConfig = smtpConfigFromEnv();
if (!smtpConfig.user || !smtpConfig.pass) {
  logger.warn('SMTP_USER or SMTP_PASS not set in .env — email send will fail.');
  logger.warn('Set credentials or use `npm run preview` to generate HTML only.');
  if (!isDryRun) {
    process.exit(1);
  }
}

const mailClient = isDryRun ? null : new SmtpMailClient(smtpConfig);

try {
  const result = await runDailyDigest(mailClient, !isDryRun);
  console.log('\n---');
  console.log(`Subject: ${result.subject}`);
  console.log(`Items:   ${result.itemCount}`);
  console.log(`Output:  ${result.outputPath}`);
  if (!isDryRun && result.itemCount === 0) {
    console.log('No qualifying items — email skipped, output saved.');
  } else if (!isDryRun && smtpConfig.user && smtpConfig.pass) {
    console.log('Email sent successfully.');
  } else if (isDryRun) {
    console.log('Dry run complete — no email sent, output saved.');
  }
  process.exit(0);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(`Send failed: ${msg}`);
  if (msg.includes('credentials')) {
    logger.error('Set SMTP_USER and SMTP_PASS in your .env file to enable email sending.');
  }
  process.exit(1);
}
