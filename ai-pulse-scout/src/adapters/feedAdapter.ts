import type { SourceAdapter } from './types.js';
import type { FetchStrategy, SourceUniverseRecord } from '../inbox/types.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import type { SourceConfig } from '../types/config.js';

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

function toSourceConfig(source: SourceUniverseRecord): SourceConfig {
  const resolved = resolveFeedSource(source.url);
  const strategy = resolved?.strategy ?? (source.classification.strategy === 'podcast_feed' ? 'podcast_feed' : 'rss_parser');
  const fetchUrl = resolved?.url ?? source.url;

  return {
    name: source.label ?? source.url,
    category: source.section,
    url: fetchUrl,
    type: strategy === 'podcast_feed' ? 'podcast' : 'rss',
    enabled: true,
  } as SourceConfig;
}

export class FeedAdapter implements SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean {
    return canUseFeedAdapter(source.classification.strategy) || resolveFeedSource(source.url) !== null;
  }

  async run(source: SourceUniverseRecord) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const result = await fetchRssSource(toSourceConfig(source), windowStart, now);

    if (result.error) {
      return {
        source,
        status: 'failed',
        discoveredCount: 0,
        error: result.error,
      } as const;
    }

    return {
      source,
      status: result.items.length > 0 ? 'success' : 'empty',
      discoveredCount: result.items.length,
    } as const;
  }
}
