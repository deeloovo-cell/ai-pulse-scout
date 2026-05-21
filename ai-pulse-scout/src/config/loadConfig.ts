import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { AppConfig, SourceConfig, DigestConfig, ScoringConfig, EmailConfig } from '../types/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../../config');

function loadYaml(filename: string): unknown {
  const content = readFileSync(join(CONFIG_DIR, filename), 'utf8');
  return yaml.load(content);
}

export function loadConfig(): AppConfig {
  const sourcesFile = loadYaml('sources.yaml') as { sources: SourceConfig[] };
  const digestFile = loadYaml('digest.yaml') as { digest: DigestConfig; scoring: ScoringConfig };
  const emailFile = loadYaml('email.yaml') as { email: EmailConfig };

  const email = emailFile.email;
  // SMTP_USER from env overrides from_address blank
  if (!email.from_address && process.env.SMTP_USER) {
    email.from_address = process.env.SMTP_USER;
  }
  if (process.env.DIGEST_TO) {
    email.to = process.env.DIGEST_TO;
  }

  return {
    sources: sourcesFile.sources,
    digest: digestFile.digest,
    scoring: digestFile.scoring,
    email,
  };
}
