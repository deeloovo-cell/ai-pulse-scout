import { describe, expect, it } from 'vitest';
import { CommunityAdapter } from '../../src/adapters/communityAdapter';
import type { SourceConfig } from '../../src/types/config';

const source: SourceConfig = {
  name: 'Community Source',
  category: 'community-signals',
  url: 'https://news.ycombinator.com/',
  type: 'community',
  enabled: true,
};

describe('CommunityAdapter', () => {
  it('returns partial support when listing-only discovery exists without destination ingestion', async () => {
    const adapter = new CommunityAdapter();
    const result = await adapter.ingest({
      source,
      windowStart: new Date('2026-05-25T23:00:00.000Z'),
      windowEnd: new Date('2026-05-26T23:00:00.000Z'),
    });

    expect(result.status).toBe('partial_supported');
    expect(result.items).toEqual([]);
    expect(result.diagnostics.reason).toContain('listing');
  });
});
