import { describe, expect, it } from 'vitest';
import { PapersAdapter } from '../../src/adapters/papersAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Papers Source',
  category: 'research',
  url: 'https://arxiv.org/list/cs.AI/recent',
  type: 'papers',
  enabled: true,
};

describe('PapersAdapter', () => {
  it('returns partial support until metadata extraction is implemented', async () => {
    const adapter = new PapersAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('metadata');
  });
});
