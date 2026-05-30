export type SourceSection = 'rss' | 'webpage' | 'youtube' | 'community' | 'docs' | 'papers';

export type SourceKind =
  | 'feed'
  | 'podcast'
  | 'youtube'
  | 'github'
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'generic_web'
  | 'research_listing'
  | 'unknown';

export type FetchStrategy =
  | 'rss_parser'
  | 'podcast_feed'
  | 'youtube_channel_resolution'
  | 'github_release_feed'
  | 'x_profile_fetch'
  | 'social_profile_deferred'
  | 'generic_web_discovery'
  | 'research_listing_discovery'
  | 'manual_review';

export interface ParsedInboxSource {
  section: SourceSection;
  subsection: string | null;
  label: string | null;
  url: string;
  line: number;
}

export interface ParsedSourceInbox {
  sections: Record<SourceSection, string[]>;
  allUrls: string[];
  categoryByUrl: Record<string, SourceSection>;
  entries: ParsedInboxSource[];
}

export interface ClassifiedSource {
  kind: SourceKind;
  strategy: FetchStrategy;
  platform: string;
  rationale: string;
  traversable: boolean;
}

export interface SourceUniverseRecord extends ParsedInboxSource {
  category: SourceSection;
  classification: ClassifiedSource;
}

export type CoverageStatus = 'success' | 'empty' | 'remove' | 'failed';

export interface CoverageResult {
  source: SourceUniverseRecord;
  status: CoverageStatus;
  discoveredCount: number;
  error?: string;
  removalReason?: string;
}
