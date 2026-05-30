import { describe, expect, it } from 'vitest';
import { evaluatePublishThreshold } from '../../src/jobs/publishThreshold.js';

describe('publish threshold policy', () => {
  it('allows publish when failed items are 50% or less and there are ready items', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 5, failedItems: 5 }),
    ).toEqual({ publishable: true, failedRatio: 0.5 });
  });

  it('blocks publish when failed items exceed 50%', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 4, failedItems: 6 }),
    ).toEqual({ publishable: false, failedRatio: 0.6 });
  });

  it('blocks publish when there are no successful items', () => {
    expect(
      evaluatePublishThreshold({ totalItems: 10, successfulItems: 0, failedItems: 2 }),
    ).toEqual({ publishable: false, failedRatio: 0.2 });
  });
});
