import { describe, expect, it } from 'vitest';
import { DocsAdapter } from '../../src/adapters/docsAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Docs Source',
  category: 'developer-tools',
  url: 'https://example.com/docs',
  type: 'docs',
  enabled: true,
};

describe('DocsAdapter', () => {
  it('returns partial support when no meaningful doc changes are detected yet', async () => {
    const adapter = new DocsAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('significance');
  });
});
