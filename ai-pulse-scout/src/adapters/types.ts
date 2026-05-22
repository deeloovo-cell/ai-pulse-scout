import type { CoverageResult, SourceUniverseRecord } from '../inbox/types.js';

export interface SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean;
  run(source: SourceUniverseRecord): Promise<CoverageResult>;
}
