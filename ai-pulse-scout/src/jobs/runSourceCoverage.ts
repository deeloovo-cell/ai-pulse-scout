import type { CoverageResult, SourceUniverseRecord } from '../inbox/types.js';

export async function runSourceCoverage(
  universe: SourceUniverseRecord[],
): Promise<CoverageResult[]> {
  return universe.map((source) => {
    if (!source.classification.traversable) {
      return {
        source,
        status: 'remove',
        discoveredCount: 0,
        removalReason: `Unreadable source for active universe: ${source.classification.rationale}`,
      };
    }

    return {
      source,
      status: 'remove',
      discoveredCount: 0,
      removalReason: `No working adapter yet for strategy ${source.classification.strategy}`,
    };
  });
}
