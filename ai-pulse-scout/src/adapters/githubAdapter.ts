import type { SourceAdapter } from './types.js';
import type { FetchStrategy, SourceUniverseRecord } from '../inbox/types.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import type { SourceConfig } from '../types/config.js';

interface ResolvedGitHubSource {
  url: string;
  strategy: Extract<FetchStrategy, 'github_release_feed'>;
}

export function canUseGitHubAdapter(strategy: FetchStrategy): boolean {
  return strategy === 'github_release_feed';
}

export function resolveGitHubSource(rawUrl: string): ResolvedGitHubSource | null {
  const match = rawUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return {
    url: `https://github.com/${match[1]}/${match[2]}/releases.atom`,
    strategy: 'github_release_feed',
  };
}

function toSourceConfig(source: SourceUniverseRecord): SourceConfig | null {
  const resolved = resolveGitHubSource(source.url);
  if (!resolved) return null;
  return {
    name: source.label ?? source.url,
    category: source.section,
    url: resolved.url,
    type: 'atom',
    enabled: true,
  } as SourceConfig;
}

export class GitHubAdapter implements SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean {
    return canUseGitHubAdapter(source.classification.strategy) || resolveGitHubSource(source.url) !== null;
  }

  async run(source: SourceUniverseRecord) {
    const config = toSourceConfig(source);
    if (!config) {
      return {
        source,
        status: 'failed',
        discoveredCount: 0,
        error: 'Unable to resolve GitHub releases feed',
      } as const;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const result = await fetchRssSource(config, windowStart, now);

    if (result.error) {
      return {
        source,
        status: 'failed',
        discoveredCount: 0,
        error: result.error,
      } as const;
    }

    return {
      source,
      status: result.items.length > 0 ? 'success' : 'empty',
      discoveredCount: result.items.length,
    } as const;
  }
}
