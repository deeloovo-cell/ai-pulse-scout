import { describe, expect, it } from 'vitest';
import type { CoverageStatus } from '../src/inbox/types.js';
import { classifySource } from '../src/inbox/classifySource.js';

describe('source universe types', () => {
  it('supports expected coverage statuses', () => {
    const statuses: CoverageStatus[] = ['success', 'empty', 'remove', 'failed'];
    expect(statuses).toHaveLength(4);
  });
});

describe('classifySource', () => {
  it('classifies representative URLs into fetch strategies', () => {
    expect(classifySource('https://blog.langchain.dev/')).toMatchObject({
      kind: 'generic_web',
      strategy: 'generic_web_discovery',
      traversable: true,
    });

    expect(classifySource('https://www.youtube.com/@aiDotEngineer')).toMatchObject({
      kind: 'youtube',
      strategy: 'youtube_channel_resolution',
      traversable: true,
    });

    expect(classifySource('https://github.com/langchain-ai/langchain')).toMatchObject({
      kind: 'github',
      strategy: 'github_release_feed',
      traversable: true,
    });

    expect(classifySource('https://x.com/sama')).toMatchObject({
      kind: 'x',
      strategy: 'x_profile_fetch',
      traversable: true,
    });

    expect(classifySource('https://www.linkedin.com/in/andrewyng/')).toMatchObject({
      kind: 'linkedin',
      strategy: 'social_profile_deferred',
      traversable: false,
    });
  });
});
