import { describe, expect, it } from 'vitest';
import { summarizeSupportStates } from '../../src/ingest/supportStatus';

describe('summarizeSupportStates', () => {
  it('counts production and partial support separately', () => {
    expect(
      summarizeSupportStates([
        { status: 'production_supported' },
        { status: 'partial_supported' },
        { status: 'broken' },
      ]),
    ).toEqual({
      production_supported: 1,
      partial_supported: 1,
      discoverable_only: 0,
      deferred: 0,
      broken: 1,
    });
  });
});
