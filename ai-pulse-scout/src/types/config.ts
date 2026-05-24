export type SourceType = 'rss' | 'atom' | 'youtube' | 'podcast' | 'github';

export type CoverageStatus =
  | 'live'
  | 'deferred_youtube'
  | 'deferred_podcast'
  | 'deferred_social'
  | 'deferred_no_feed'
  | 'deferred_github_watch';

export interface SourceConfig {
  name: string;
  category: string;
  url: string;
  type: SourceType;
  enabled?: boolean;
  coverage_status?: CoverageStatus;
  notes?: string;
}

export interface DigestConfig {
  max_items: number;
  collection_window_hours: number;
  safety_buffer_hours: number;
}

export interface EmailConfig {
  to: string;
  from_name: string;
  from_address: string;
  subject_template: string;
  reply_to: string;
}

export interface AppConfig {
  sources: SourceConfig[];
  digest: DigestConfig;
  email: EmailConfig;
}
