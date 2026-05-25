import type { ParsedInboxSource, ParsedSourceInbox, SourceSection } from './types.js';

const SECTION_NAMES: SourceSection[] = ['rss', 'webpage', 'youtube', 'community', 'docs', 'papers'];

function createEmptySections(): Record<SourceSection, string[]> {
  return {
    rss: [],
    webpage: [],
    youtube: [],
    community: [],
    docs: [],
    papers: [],
  };
}

function isSourceSection(value: string): value is SourceSection {
  return SECTION_NAMES.includes(value as SourceSection);
}

export function parseSourceInbox(markdown: string): ParsedSourceInbox {
  const lines = markdown.split(/\r?\n/);
  const entries: ParsedInboxSource[] = [];
  const sections = createEmptySections();
  const categoryByUrl: Record<string, SourceSection> = {};
  const allUrls: string[] = [];
  let section: SourceSection = 'webpage';
  let subsection: string | null = null;

  lines.forEach((line, idx) => {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const heading = h2[1].trim().toLowerCase();
      if (isSourceSection(heading)) {
        section = heading;
        subsection = null;
      }
      return;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      subsection = h3[1].trim();
      return;
    }

    const bulletUrl = line.match(/^\s*[-*•]\s+(https?:\/\/\S+)$/);
    if (bulletUrl) {
      const url = bulletUrl[1];
      const entry: ParsedInboxSource = {
        section,
        subsection,
        label: null,
        url,
        line: idx + 1,
      };
      entries.push(entry);
      sections[section].push(url);
      allUrls.push(url);
      categoryByUrl[url] = section;
    }
  });

  return {
    sections,
    allUrls,
    categoryByUrl,
    entries,
  };
}
