import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { summarizeCoverage } from '../src/inbox/coverageReport.js';
import type { CoverageResult, SourceUniverseRecord } from '../src/inbox/types.js';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';
import { runSourceCoverage } from '../src/jobs/runSourceCoverage.js';
import { canUseFeedAdapter, resolveFeedSource } from '../src/adapters/feedAdapter.js';
import { canUseGitHubAdapter, resolveGitHubSource } from '../src/adapters/githubAdapter.js';
import { canUseYouTubeAdapter, resolveYouTubeSource } from '../src/adapters/youtubeAdapter.js';
import { extractFeedUrlFromHtml, extractRecentArticleLinksFromHtml } from '../src/adapters/genericWebAdapter.js';

describe('feedAdapter', () => {
  it('supports feed-like strategies and rejects others', () => {
    expect(canUseFeedAdapter('rss_parser')).toBe(true);
    expect(canUseFeedAdapter('podcast_feed')).toBe(true);
    expect(canUseFeedAdapter('generic_web_discovery')).toBe(false);
  });

  it('resolves known feed-capable raw URLs to feed strategies', () => {
    expect(resolveFeedSource('https://blog.langchain.dev/')).toMatchObject({
      strategy: 'rss_parser',
      url: 'https://blog.langchain.dev/rss/',
    });

    expect(resolveFeedSource('https://www.latent.space/')).toMatchObject({
      strategy: 'rss_parser',
      url: 'https://www.latent.space/feed',
    });

    expect(resolveFeedSource('https://changelog.com/practicalai')).toMatchObject({
      strategy: 'podcast_feed',
      url: 'https://changelog.com/practicalai/feed',
    });
  });
});

describe('githubAdapter', () => {
  it('supports github coverage and resolves repo URLs to release feeds', () => {
    expect(canUseGitHubAdapter('github_release_feed')).toBe(true);
    expect(canUseGitHubAdapter('generic_web_discovery')).toBe(false);
    expect(resolveGitHubSource('https://github.com/langchain-ai/langchain')).toMatchObject({
      url: 'https://github.com/langchain-ai/langchain/releases.atom',
      strategy: 'github_release_feed',
    });
  });
});

describe('youtubeAdapter', () => {
  it('supports youtube coverage and resolves known handles to feed URLs', () => {
    expect(canUseYouTubeAdapter('youtube_channel_resolution')).toBe(true);
    expect(canUseYouTubeAdapter('generic_web_discovery')).toBe(false);
    expect(resolveYouTubeSource('https://www.youtube.com/@aiDotEngineer')).toMatchObject({
      strategy: 'youtube_channel_resolution',
      url: expect.stringContaining('https://www.youtube.com/feeds/videos.xml?channel_id='),
    });
  });
});

describe('genericWebAdapter', () => {
  it('extracts feed URLs from html link tags', () => {
    const html = '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>';
    expect(extractFeedUrlFromHtml('https://example.com/blog', html)).toBe('https://example.com/feed.xml');
  });

  it('extracts likely recent article links when no feed is present', () => {
    const html = '<html><body><a href="/posts/a">A</a><a href="/posts/b">B</a><a href="/about">About</a></body></html>';
    expect(extractRecentArticleLinksFromHtml('https://example.com', html)).toEqual([
      'https://example.com/posts/a',
      'https://example.com/posts/b',
    ]);
  });
});

describe('coverage reporting', () => {
  it('counts sources by status', () => {
    const results = [
      { status: 'success', discoveredCount: 3 },
      { status: 'remove', discoveredCount: 0, removalReason: 'Auth-gated or unreadable' },
      { status: 'failed', discoveredCount: 0 },
    ] as CoverageResult[];

    expect(summarizeCoverage(results)).toMatchObject({
      totalSources: 3,
      success: 1,
      remove: 1,
      failed: 1,
    });
  });
});

describe('real source inbox coverage baseline', () => {
  it('parses all source inbox URLs into universe records', () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    expect(universe.length).toBe(113);
  });
});

describe('runSourceCoverage', () => {
  it('uses adapter results when an adapter is provided', async () => {
    const source = {
      section: 'rss_newsletters',
      subsection: null,
      label: null,
      url: 'https://example.com/feed.xml',
      line: 1,
      classification: {
        kind: 'feed',
        strategy: 'rss_parser',
        platform: 'example.com',
        rationale: 'feed url',
        traversable: true,
      },
    } satisfies SourceUniverseRecord;

    const fakeAdapter = {
      canHandle: vi.fn().mockReturnValue(true),
      run: vi.fn().mockResolvedValue({
        source,
        status: 'success',
        discoveredCount: 2,
      }),
    };

    const results = await runSourceCoverage([source], { adapters: [fakeAdapter] });

    expect(fakeAdapter.canHandle).toHaveBeenCalled();
    expect(fakeAdapter.run).toHaveBeenCalled();
    expect(results[0]).toMatchObject({ status: 'success', discoveredCount: 2 });
  });
});

describe('real inbox coverage summary', () => {
  it('accounts for every source in the coverage summary', async () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    const fakeAdapter = {
      canHandle: vi.fn().mockImplementation((source: SourceUniverseRecord) => source.url === 'https://blog.langchain.dev/'),
      run: vi.fn().mockResolvedValue({
        source: universe.find((s) => s.url === 'https://blog.langchain.dev/')!,
        status: 'success',
        discoveredCount: 1,
      }),
    };
    const results = await runSourceCoverage(universe, { adapters: [fakeAdapter] });
    const summary = summarizeCoverage(results);

    expect(summary.totalSources).toBe(113);
    expect(summary.success + summary.empty + summary.remove + summary.failed).toBe(113);
    expect(summary.success).toBe(1);
  });
});
