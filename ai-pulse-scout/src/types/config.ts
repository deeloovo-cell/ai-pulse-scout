export type SourceType = 'rss' | 'atom' | 'youtube' | 'podcast' | 'github';

export interface SourceConfig {
  name: string;
  category: string;
  url: string;
  type: SourceType;
}

export interface ScoringConfig {
  ai_engineering_keywords: string[];
  industrial_ai_keywords: string[];
  cad_cae_cam_keywords: string[];
  executive_signal_keywords: string[];
  aac_relevance_keywords: string[];
  high_signal_boost_keywords: string[];
  low_signal_penalty_keywords: string[];
}

export interface DigestConfig {
  max_items: number;
  min_items: number;
  collection_window_hours: number;
  safety_buffer_hours: number;
  min_score: number;
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
  scoring: ScoringConfig;
  email: EmailConfig;
}
