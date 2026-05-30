import { classifySource } from './classifySource.js';
import { parseSourceInbox } from './parseSourceInbox.js';
import type { SourceUniverseRecord } from './types.js';

export function buildSourceUniverse(markdown: string): SourceUniverseRecord[] {
  return parseSourceInbox(markdown).entries.map((entry) => ({
    ...entry,
    category: entry.section,
    classification: classifySource(entry.url),
  }));
}
