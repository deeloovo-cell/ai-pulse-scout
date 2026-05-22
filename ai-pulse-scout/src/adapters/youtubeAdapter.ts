import type { SourceAdapter } from './types.js';
import type { FetchStrategy, SourceUniverseRecord } from '../inbox/types.js';
import { fetchRssSource } from '../fetchers/rssFetcher.js';
import type { SourceConfig } from '../types/config.js';

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

function toSourceConfig(source: SourceUniverseRecord): SourceConfig | null {
  const resolved = resolveYouTubeSource(source.url);
  if (!resolved) return null;
  return {
    name: source.label ?? source.url,
    category: source.section,
    url: resolved.url,
    type: 'rss',
    enabled: true,
  } as SourceConfig;
}

export class YouTubeAdapter implements SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean {
    return canUseYouTubeAdapter(source.classification.strategy) || resolveYouTubeSource(source.url) !== null;
  }

  async run(source: SourceUniverseRecord) {
    const config = toSourceConfig(source);
    if (!config) {
      return {
        source,
        status: 'failed',
        discoveredCount: 0,
        error: 'Unable to resolve YouTube channel feed',
      } as const;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const result = await fetchRssSource(config, windowStart, now);

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
