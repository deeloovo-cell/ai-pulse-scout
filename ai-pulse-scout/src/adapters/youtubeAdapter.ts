import { FeedAdapter } from './feedAdapter.js';
import type { SourceConfig } from '../types/config.js';
import type { ProductionSourceAdapter } from './types.js';
import type { FetchStrategy } from '../inbox/types.js';

interface ResolvedYouTubeSource {
  url: string;
  strategy: Extract<FetchStrategy, 'youtube_channel_resolution'>;
}

const YOUTUBE_CHANNEL_MAP: Record<string, string> = {
  'https://www.youtube.com/@aiDotEngineer': 'UCWZ_4xk8lA9tY0D9M1bJ6WQ',
  'https://www.youtube.com/@LatentSpacePod': 'UCY1e8m9Ck4R7f6Qw7h9sJ2Q',
  'https://www.youtube.com/@Deeplearningai': 'UCcIXc5mJsHVYTZR1maL5l9w',
  'https://www.youtube.com/@IBMTechnology': 'UC9x0AN7BWHpCDHSm9NiJFJQ',
  'https://www.youtube.com/@NVIDIAOmniverse': 'UCSKUoczbGAcMld7HjpCR8OA',
  'https://www.youtube.com/@siemens': 'UC3vRct6pzJpE0P-7pGtbx1Q',
  'https://www.youtube.com/@3DSDassaultSystemes': 'UC2N2U6sV0dQ5T5o8M3j9J8A',
  'https://www.youtube.com/@ansys': 'UCjQmC6Qx0z0wW2JQ8dNf3kg',
  'https://www.youtube.com/@lexfridman': 'UCSHZKyawb77ixDdsGog4iWA',
};

export function canUseYouTubeAdapter(strategy: FetchStrategy): boolean {
  return strategy === 'youtube_channel_resolution';
}

export function resolveYouTubeSource(rawUrl: string): ResolvedYouTubeSource | null {
  const channelId = YOUTUBE_CHANNEL_MAP[rawUrl];
  if (!channelId) return null;
  return {
    url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    strategy: 'youtube_channel_resolution',
  };
}

export class YouTubeAdapter implements ProductionSourceAdapter {
  canHandle(source: SourceConfig): boolean {
    return source.type === 'youtube' || resolveYouTubeSource(source.url) !== null;
  }

  async ingest({ source, windowStart, windowEnd }: { source: SourceConfig; windowStart: Date; windowEnd: Date; }) {
    const resolved = resolveYouTubeSource(source.url);
    if (!resolved) {
      return {
        source,
        status: 'broken' as const,
        items: [],
        diagnostics: {
          attempted: 0,
          normalized: 0,
          dropped: 0,
          adapterType: 'youtube',
          reason: 'Unable to resolve YouTube channel feed',
        },
      };
    }

    const feedAdapter = new FeedAdapter();
    const result = await feedAdapter.ingest({
      source: { ...source, url: resolved.url, type: 'rss' },
      windowStart,
      windowEnd,
    });

    return {
      ...result,
      source,
      items: result.items.map((item) => ({
        ...item,
        sourceType: 'youtube',
        sourceUrl: source.url,
        sourceName: source.name,
        source_name: source.name,
        source_url: source.url,
        content_type: 'video',
        rawMetadata: {
          ...item.rawMetadata,
          adapterType: 'youtube',
          resolvedFeedUrl: resolved.url,
        },
      })),
      diagnostics: {
        ...result.diagnostics,
        adapterType: 'youtube',
      },
    };
  }
}
