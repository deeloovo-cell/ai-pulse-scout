import { describe, expect, it } from 'vitest';
import { resolveGitHubSource } from '../../src/adapters/githubAdapter';

describe('GitHubAdapter', () => {
  it('converts repository URLs into releases feeds', () => {
    expect(resolveGitHubSource('https://github.com/openai/openai-cookbook')).toEqual({
      url: 'https://github.com/openai/openai-cookbook/releases.atom',
      strategy: 'github_release_feed',
    });
  });
});
