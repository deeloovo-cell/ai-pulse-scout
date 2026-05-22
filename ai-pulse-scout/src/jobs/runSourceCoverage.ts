import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import type { SourceAdapter } from '../adapters/types.js';
import type { CoverageResult, SourceUniverseRecord } from '../inbox/types.js';

interface RunSourceCoverageOptions {
  adapters?: SourceAdapter[];
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

    const adapter = adapters.find((candidate) => candidate.canHandle(source));
    if (adapter) {
      results.push(await adapter.run(source));
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
