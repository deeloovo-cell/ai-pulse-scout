import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';
import type { ProductionSourceAdapter } from '../adapters/types.js';
import type { CoverageResult, SourceUniverseRecord } from '../inbox/types.js';

interface RunSourceCoverageOptions {
  adapters?: ProductionSourceAdapter[];
}

function toSourceConfig(source: SourceUniverseRecord) {
  const typeMap: Record<string, string> = {
    rss: 'rss',
    webpage: 'webpage',
    youtube: 'youtube',
    community: 'community',
    docs: 'docs',
    papers: 'papers',
  };

  return {
    name: source.label ?? source.url,
    category: source.section,
    url: source.url,
    type: (typeMap[source.section] ?? 'webpage') as any,
    enabled: true,
  };
}

export async function runSourceCoverage(
  universe: SourceUniverseRecord[],
  options: RunSourceCoverageOptions = {},
): Promise<CoverageResult[]> {
  const adapters = options.adapters ?? [
    new FeedAdapter(),
    new GitHubAdapter(),
    new YouTubeAdapter(),
    new GenericWebAdapter(),
    new DocsAdapter(),
    new CommunityAdapter(),
    new PapersAdapter(),
  ];
  const results: CoverageResult[] = [];

  for (const source of universe) {
    if (!source.classification.traversable) {
      results.push({
        source,
        status: 'remove',
        discoveredCount: 0,
        removalReason: `Unreadable source for active universe: ${source.classification.rationale}`,
      });
      continue;
    }

    const sourceConfig = toSourceConfig(source);
    const adapter = adapters.find((candidate) => candidate.canHandle(sourceConfig as any));
    if (adapter) {
      if ('ingest' in adapter && typeof adapter.ingest === 'function') {
        const ingestion = await adapter.ingest({
          source: sourceConfig as any,
          windowStart: new Date(Date.now() - 48 * 60 * 60 * 1000),
          windowEnd: new Date(),
        });
        results.push({
          source,
          status:
            ingestion.status === 'broken'
              ? 'failed'
              : ingestion.items.length > 0
                ? 'success'
                : ingestion.status === 'partial_supported'
                  ? 'empty'
                  : 'empty',
          discoveredCount: ingestion.items.length,
          error: ingestion.diagnostics.reason,
        });
      } else if ('run' in adapter && typeof (adapter as any).run === 'function') {
        results.push(await (adapter as any).run(source));
      }
      continue;
    }

    results.push({
      source,
      status: 'remove',
      discoveredCount: 0,
      removalReason: `No working adapter yet for strategy ${source.classification.strategy}`,
    });
  }

  return results;
}
