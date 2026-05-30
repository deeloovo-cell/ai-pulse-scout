import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('sendTest CLI smoke', () => {
  it('still routes through runDailyDigest entrypoint', () => {
    const file = readFileSync(join(process.cwd(), 'src/cli/sendTest.ts'), 'utf8');
    expect(file).toContain("runDailyDigest(mailClient, !isDryRun)");
  });
});
