import 'dotenv/config';
import { runDailyDigest } from '../jobs/runDailyDigest.js';
import { SmtpMailClient, smtpConfigFromEnv } from '../mail/SmtpMailClient.js';
import { logger } from '../utils/logger.js';

logger.info('=== AI Pulse Scout — Daily Send ===');

const smtpConfig = smtpConfigFromEnv();
if (!smtpConfig.user || !smtpConfig.pass) {
  logger.error('SMTP_USER or SMTP_PASS not set in .env');
  process.exit(1);
}

const result = await runDailyDigest(new SmtpMailClient(smtpConfig), true);
console.log('---');
console.log(`Subject: ${result.subject}`);
console.log(`Items:   ${result.itemCount}`);
console.log(`Output:  ${result.outputPath}`);
