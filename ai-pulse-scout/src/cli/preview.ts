import 'dotenv/config';
import { runDailyDigest } from '../jobs/runDailyDigest.js';
import { logger } from '../utils/logger.js';

logger.info('=== AI Pulse Scout — Preview Mode ===');
logger.info('Fetching sources and generating digest (no email will be sent)...\n');

try {
  const result = await runDailyDigest(null, false);
  console.log('\n---');
  console.log(`Subject: ${result.subject}`);
  console.log(`Items:   ${result.itemCount}`);
  console.log(`Output:  ${result.outputPath}`);
  if (result.itemCount === 0) {
    console.log('\n[!] No items found in the collection window. Check feed activity or widen collection_window_hours in config/digest.yaml');
  }
} catch (err) {
  logger.error('Preview failed:', err);
  process.exit(1);
}
