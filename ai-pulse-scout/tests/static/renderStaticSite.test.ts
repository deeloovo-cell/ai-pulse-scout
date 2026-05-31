import { describe, expect, it } from 'vitest';
import { renderStaticIndexPage, renderStaticDayPage } from '../../src/static/renderStaticSite.js';
import type { NormalizedItem } from '../../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'static-item-1',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com/feed.xml',
    item_url: 'https://example.com/posts/static-item-1',
    title: 'Static export item',
    published_at: new Date('2026-05-30T03:00:00.000Z'),
    fetched_at: new Date('2026-05-30T04:00:00.000Z'),
    author: 'Tester',
    content_text: 'Full content for the static export item.',
    summary: 'Short summary for the static export item.',
    tags: ['Agents'],
    content_type: 'article',
    fingerprint: 'fp-static-item-1',
    relevance_scores: {
      ai_engineering: 0.8,
      industrial_ai: 0.2,
      cad_cae_cam: 0,
      executive_signal: 0.4,
      aac_relevance: 0.1,
      overall: 0.8,
    },
    decision: 'include',
    decision_reason: 'score=0.80',
    primary_topic: 'AI Developer Tools & Agents',
    rawMetadata: {},
    ...overrides,
  } as NormalizedItem;
}

describe('renderStaticIndexPage', () => {
  it('renders homepage content with recent-days navigation and digest items', () => {
    const html = renderStaticIndexPage({
      siteTitle: 'AI Pulse Scout Daily',
      targetDate: '2026-05-30',
      recentDays: ['2026-05-30'],
      items: [makeItem()],
    });

    expect(html).toContain('AI Pulse Scout Daily');
    expect(html).toContain('2026-05-30');
    expect(html).toContain('最近 7 天');
    expect(html).toContain('href="days/2026-05-30.html"');
    expect(html).toContain('Static export item');
    expect(html).toContain('https://example.com/posts/static-item-1');
  });

  it('renders a valid empty state when no items exist', () => {
    const html = renderStaticIndexPage({
      siteTitle: 'AI Pulse Scout Daily',
      targetDate: '2026-05-30',
      recentDays: ['2026-05-30'],
      items: [],
    });

    expect(html).toContain('当前没有可展示的 digest 内容');
  });
});

describe('renderStaticDayPage', () => {
  it('renders archive page content with a homepage backlink', () => {
    const html = renderStaticDayPage({
      siteTitle: 'AI Pulse Scout Daily',
      targetDate: '2026-05-30',
      homeHref: '../index.html',
      items: [makeItem()],
    });

    expect(html).toContain('AI Pulse Scout Daily');
    expect(html).toContain('2026-05-30');
    expect(html).toContain('href="../index.html"');
    expect(html).toContain('返回首页');
    expect(html).toContain('Static export item');
  });
});
