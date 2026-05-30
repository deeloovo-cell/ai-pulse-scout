import { describe, expect, it } from 'vitest';
import { resolveYouTubeSource } from '../../src/adapters/youtubeAdapter';

describe('YouTubeAdapter', () => {
  it('resolves known channel URLs to feed URLs', () => {
    expect(resolveYouTubeSource('https://www.youtube.com/@IBMTechnology')).toEqual({
      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9x0AN7BWHpCDHSm9NiJFJQ',
      strategy: 'youtube_channel_resolution',
    });
  });
});
