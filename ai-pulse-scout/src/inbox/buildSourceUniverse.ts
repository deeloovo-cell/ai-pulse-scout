import { classifySource } from './classifySource.js';
import { parseSourceInbox } from './parseSourceInbox.js';
import type { SourceUniverseRecord } from './types.js';

export function buildSourceUniverse(markdown: string): SourceUniverseRecord[] {
  return parseSourceInbox(markdown).map((entry) => ({
    ...entry,
    classification: classifySource(entry.url),
  }));
}
