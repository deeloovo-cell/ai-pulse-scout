import { describe, expect, it } from 'vitest';
import { computeAutoDeployDigestDate } from '../../src/static/exportStaticSiteCli.js';

describe('build:site deployment semantics', () => {
  it('computes a deployable digest date without requiring manual CLI input', () => {
    const date = computeAutoDeployDigestDate(new Date('2026-05-31T23:30:00.000Z'));

    expect(date).toBe('2026-06-01');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
