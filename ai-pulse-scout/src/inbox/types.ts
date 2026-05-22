export type SourceSection =
  | 'core_ai_engineering'
  | 'industrial_ai'
  | 'cad_cae_cam'
  | 'youtube_channels'
  | 'podcasts'
  | 'rss_newsletters'
  | 'research_sources'
  | 'open_source_communities'
  | 'ai_leaders_blogs'
  | 'ai_leaders_social'
  | 'ai_leaders_media'
  | 'enterprise_industrial_ai_leaders'
  | 'academic_research_leaders'
  | 'third_party_ai_news'
  | 'data_science_ai_engineering'
  | 'consulting_enterprise_ai'
  | 'industrial_engineering_ai'
  | 'ai_research_reports'
  | 'unknown';

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

export interface ClassifiedSource {
  kind: SourceKind;
  strategy: FetchStrategy;
  platform: string;
  rationale: string;
  traversable: boolean;
}

export interface SourceUniverseRecord extends ParsedInboxSource {
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
