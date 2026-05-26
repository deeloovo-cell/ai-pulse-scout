import { describe, expect, it } from 'vitest';
import { normalizePublishedAt } from '../../src/ingest/timestamps';

describe('normalizePublishedAt', () => {
  it('marks ISO timestamps as exact', () => {
    expect(normalizePublishedAt('2026-05-26T00:00:00.000Z')).toEqual({
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'exact',
    });
  });

  it('returns weak confidence when only a date is available', () => {
    expect(normalizePublishedAt('2026-05-26')).toEqual({
      publishedAt: '2026-05-26T00:00:00.000Z',
      publishedAtConfidence: 'weak',
    });
  });

  it('returns unknown when timestamp is missing', () => {
    expect(normalizePublishedAt(undefined)).toEqual({
      publishedAt: null,
      publishedAtConfidence: 'unknown',
    });
  });
});
