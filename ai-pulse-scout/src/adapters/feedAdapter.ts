import { randomUUID } from 'node:crypto';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import { buildStableIdentity } from '../ingest/identity.js';
import { normalizePublishedAt } from '../ingest/timestamps.js';
import type { IngestedItem, SourceIngestionResult } from '../ingest/types.js';
import type { FetchStrategy } from '../inbox/types.js';
import type { SourceConfig } from '../types/config.js';
import type { ProductionSourceAdapter } from './types.js';
import { inferPrimaryTopic } from '../topics/inferPrimaryTopic.js';

interface ResolvedFeedSource {
  url: string;
  strategy: Extract<FetchStrategy, 'rss_parser' | 'podcast_feed'>;
}

const FEED_URL_MAP: Record<string, ResolvedFeedSource> = {
  'https://blog.langchain.dev/': {
    url: 'https://blog.langchain.dev/rss/',
    strategy: 'rss_parser',
  },
  'https://www.latent.space/': {
    url: 'https://www.latent.space/feed',
    strategy: 'rss_parser',
  },
  'https://www.bensbites.com/': {
    url: 'https://www.bensbites.com/feed',
    strategy: 'rss_parser',
  },
  'https://www.deeplearning.ai/the-batch/': {
    url: 'https://www.deeplearning.ai/the-batch/rss.xml',
    strategy: 'rss_parser',
  },
  'https://importai.substack.com/': {
    url: 'https://importai.substack.com/feed',
    strategy: 'rss_parser',
  },
  'https://thesequence.substack.com/': {
    url: 'https://thesequence.substack.com/feed',
    strategy: 'rss_parser',
  },
  'https://semianalysis.com/': {
    url: 'https://www.semianalysis.com/feed',
    strategy: 'rss_parser',
  },
  'https://magazine.sebastianraschka.com/': {
    url: 'https://magazine.sebastianraschka.com/feed',
    strategy: 'rss_parser',
  },
  'https://changelog.com/practicalai': {
    url: 'https://changelog.com/practicalai/feed',
    strategy: 'podcast_feed',
  },
  'https://lexfridman.com/podcast/': {
    url: 'https://lexfridman.com/feed/podcast',
    strategy: 'podcast_feed',
  },
};

export function canUseFeedAdapter(strategy: FetchStrategy): boolean {
  return strategy === 'rss_parser' || strategy === 'podcast_feed';
}

export function resolveFeedSource(rawUrl: string): ResolvedFeedSource | null {
  return FEED_URL_MAP[rawUrl] ?? null;
}

export interface FeedFetchItem {
  title: string;
  url: string;
  content: string;
  author?: string;
  publishedAt?: string | null;
}

function toIngestedItem(source: SourceConfig, item: FeedFetchItem): IngestedItem {
  const published = normalizePublishedAt(item.publishedAt ?? null);
  const stableIdentity = buildStableIdentity({
    canonicalUrl: item.url,
    itemUrl: item.url,
    sourceUrl: source.url,
    title: item.title,
    publishedAt: published.publishedAt,
  });
  const topic = inferPrimaryTopic({
    sourceUrl: source.url,
    title: item.title,
    content: item.content,
  });

  return {
    sourceType: source.type,
    sourceUrl: source.url,
    sourceName: source.name,
    itemUrl: item.url,
    canonicalUrl: item.url,
    title: item.title,
    publishedAt: published.publishedAt,
    publishedAtConfidence: published.publishedAtConfidence,
    discoveredAt: new Date().toISOString(),
    content: item.content,
    summaryMaterial: item.content,
    stableIdentity,
    topicHints: [topic],
    rawMetadata: {
      sourceCategory: source.category,
      adapterType: 'feed',
    },
    id: randomUUID(),
    source_name: source.name,
    source_category: source.category,
    source_url: source.url,
    item_url: item.url,
    published_at: published.publishedAt ? new Date(published.publishedAt) : null,
    fetched_at: new Date(),
    author: item.author ?? '',
    content_text: item.content,
    summary: item.content.slice(0, 300),
    tags: [],
    content_type: source.type === 'podcast' ? 'podcast' : 'article',
    fingerprint: stableIdentity,
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: topic,
  };
}

export class FeedAdapter implements ProductionSourceAdapter {
  constructor(
    private readonly deps: {
      fetchFeedItems?: (input: {
        source: SourceConfig;
        windowStart: Date;
        windowEnd: Date;
      }) => Promise<IngestedItem[]>;
    } = {},
  ) {}

  canHandle(source: SourceConfig): boolean {
    return source.type === 'rss' || source.type === 'atom' || source.type === 'podcast';
  }

  async ingest({
    source,
    windowStart,
    windowEnd,
  }: {
    source: SourceConfig;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<SourceIngestionResult> {
    try {
      let items: IngestedItem[];

      if (this.deps.fetchFeedItems) {
        items = await this.deps.fetchFeedItems({ source, windowStart, windowEnd });
      } else {
        items = (await fetchRssSource(source, windowStart, windowEnd)).items.map((item) =>
          toIngestedItem(source, {
            title: item.title,
            url: item.item_url,
            content: item.content_text,
            author: item.author,
            publishedAt: item.published_at?.toISOString() ?? null,
          }),
        );
      }

      return {
        source,
        status: 'production_supported',
        items,
        diagnostics: {
          attempted: items.length,
          normalized: items.length,
          dropped: 0,
          adapterType: 'feed',
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        source,
        status: 'partial_supported',
        items: [],
        diagnostics: {
          attempted: 1,
          normalized: 0,
          dropped: 0,
          adapterType: 'feed',
          reason,
        },
      };
    }
  }
}
