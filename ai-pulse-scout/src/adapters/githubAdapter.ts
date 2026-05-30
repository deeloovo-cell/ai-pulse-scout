import { FeedAdapter } from './feedAdapter.js';
import type { SourceConfig } from '../types/config.js';
import type { ProductionSourceAdapter } from './types.js';
import type { FetchStrategy } from '../inbox/types.js';

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

export class GitHubAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'github' || resolveGitHubSource(source.url) !== null;
  }

  async ingest({ source, windowStart, windowEnd }: { source: SourceConfig; windowStart: Date; windowEnd: Date; }) {
    const resolved = resolveGitHubSource(source.url);
    if (!resolved) {
      return {
        source,
        status: 'broken' as const,
        items: [],
        diagnostics: {
          attempted: 0,
          normalized: 0,
          dropped: 0,
          adapterType: 'github',
          reason: 'Unable to resolve GitHub releases feed',
        },
      };
    }

    const feedAdapter = new FeedAdapter();
    const result = await feedAdapter.ingest({
      source: { ...source, url: resolved.url, type: 'atom' },
      windowStart,
      windowEnd,
    });

    return {
      ...result,
      source,
      items: result.items.map((item) => ({
        ...item,
        sourceType: 'github',
        sourceUrl: source.url,
        sourceName: source.name,
        source_name: source.name,
        source_url: source.url,
        content_type: 'repo_update',
        rawMetadata: {
          ...item.rawMetadata,
          adapterType: 'github',
          resolvedFeedUrl: resolved.url,
        },
      })),
      diagnostics: {
        ...result.diagnostics,
        adapterType: 'github',
      },
    };
  }
}
