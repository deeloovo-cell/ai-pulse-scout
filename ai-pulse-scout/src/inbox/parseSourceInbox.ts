import type { ParsedInboxSource, SourceSection } from './types.js';

const SECTION_MAP: Array<{ pattern: RegExp; section: SourceSection }> = [
  { pattern: /^core ai engineering/i, section: 'core_ai_engineering' },
  { pattern: /^industrial ai/i, section: 'industrial_ai' },
  { pattern: /^ai for cad/i, section: 'cad_cae_cam' },
  { pattern: /^youtube channels/i, section: 'youtube_channels' },
  { pattern: /^podcasts$/i, section: 'podcasts' },
  { pattern: /^rss\s*\/\s*newsletters/i, section: 'rss_newsletters' },
  { pattern: /^research sources/i, section: 'research_sources' },
  { pattern: /^open source/i, section: 'open_source_communities' },
  { pattern: /^blogs\s*\/\s*personal sites/i, section: 'ai_leaders_blogs' },
  { pattern: /^social\s*\/\s*professional profiles/i, section: 'ai_leaders_social' },
  { pattern: /^podcasts\s*\/\s*media/i, section: 'ai_leaders_media' },
  { pattern: /^enterprise\s*\/\s*industrial ai leaders/i, section: 'enterprise_industrial_ai_leaders' },
  { pattern: /^academic\s*\/\s*research leaders/i, section: 'academic_research_leaders' },
  { pattern: /^ai news\s*\/\s*enterprise ai/i, section: 'third_party_ai_news' },
  { pattern: /^data science\s*\/\s*ai engineering/i, section: 'data_science_ai_engineering' },
  { pattern: /^consulting\s*\/\s*enterprise ai strategy/i, section: 'consulting_enterprise_ai' },
  { pattern: /^industrial ai\s*\/\s*engineering ai/i, section: 'industrial_engineering_ai' },
  { pattern: /^ai research\s*\/\s*benchmark reports/i, section: 'ai_research_reports' },
];

function mapHeadingToSection(text: string, fallback: SourceSection): SourceSection {
  const normalized = text.trim().toLowerCase();
  for (const entry of SECTION_MAP) {
    if (entry.pattern.test(normalized)) return entry.section;
  }
  return fallback;
}

export function parseSourceInbox(markdown: string): ParsedInboxSource[] {
  const lines = markdown.split(/\r?\n/);
  const results: ParsedInboxSource[] = [];
  let section: SourceSection = 'unknown';
  let subsection: string | null = null;

  lines.forEach((line, idx) => {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      section = mapHeadingToSection(h2[1], section);
      subsection = null;
      return;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      subsection = h3[1].trim();
      section = mapHeadingToSection(subsection, section);
      return;
    }

    const bulletUrl = line.match(/^\s*[-*•]\s+(https?:\/\/\S+)$/);
    if (bulletUrl) {
      results.push({
        section,
        subsection,
        label: null,
        url: bulletUrl[1],
        line: idx + 1,
      });
    }
  });

  return results;
}
