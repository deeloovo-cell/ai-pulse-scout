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
      siteTitle: 'The Daily Scout',
      targetDate: '2026-05-30',
      recentDays: ['2026-05-30'],
      items: [makeItem()],
    });

    expect(html).toContain('<title>The Daily Scout - 2026-05-30</title>');
    expect(html).toContain('<h1 class="title">The Daily Scout</h1>');
    expect(html).toContain('2026-05-30');
    expect(html).toContain('最近 7 天');
    expect(html).toContain('href="days/2026-05-30.html"');
    expect(html).toContain('Static export item');
    expect(html).toContain('https://example.com/posts/static-item-1');
  });

  it('renders match pill, Chinese topic badges, and footer metadata for each item', () => {
    const html = renderStaticIndexPage({
      siteTitle: 'AI Pulse Scout',
      targetDate: '2026-05-31',
      recentDays: ['2026-05-31'],
      items: [makeItem({
        title: 'Agentic coding workflow improves triage quality',
        summary: '普通摘要',
        content_text: 'Longer raw fallback text for the item body.',
      })],
    });

    expect(html).toContain('% match');
    expect(html).toContain('Relevant rank');
    expect(html).toContain('Follow-up');
    expect(html).toContain('智能体');
  });

  it('does not render raw source-origin labels such as arXiv category tags', () => {
    const html = renderStaticIndexPage({
      siteTitle: 'AI Pulse Scout',
      targetDate: '2026-05-31',
      recentDays: ['2026-05-31'],
      items: [makeItem({
        title: 'Vision-language system improves robotics planning',
        summary: '摘要',
        content_text: 'raw content',
        item_url: 'https://arxiv.org/abs/1234.5678',
        source_name: 'arXiv cs.AI',
        source_category: 'cs.AI',
      })],
    });

    expect(html).not.toContain('cs.AI');
    expect(html).not.toContain('cs.LG');
    expect(html).not.toContain('arXiv cs.AI');
  });

  it('renders a valid empty state when no items exist', () => {
    const html = renderStaticIndexPage({
      siteTitle: 'The Daily Scout',
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
      siteTitle: 'The Daily Scout',
      targetDate: '2026-05-30',
      homeHref: '../index.html',
      items: [makeItem()],
    });

    expect(html).toContain('<title>The Daily Scout - 2026-05-30</title>');
    expect(html).toContain('<h1 class="title">The Daily Scout</h1>');
    expect(html).toContain('2026-05-30');
    expect(html).toContain('href="../index.html"');
    expect(html).toContain('返回首页');
    expect(html).toContain('Static export item');
  });

  it('prefers enrichment-style summary content over plain summary and raw snippet', () => {
    const html = renderStaticDayPage({
      siteTitle: 'AI Pulse Scout',
      targetDate: '2026-05-31',
      homeHref: '../index.html',
      items: [makeItem({
        title: 'Multimodal model reduces annotation cost',
        summary: '普通摘要不应优先出现',
        content_text: 'raw snippet fallback text',
        key_insight: '这项工作更值得关注，因为它把多模态训练成本压低到了更易部署的水平。它同时展示了数据效率和工程可落地性的改进。',
      })],
    });

    expect(html).toContain('这项工作更值得关注');
    expect(html).not.toContain('普通摘要不应优先出现');
  });

  it('falls back to a Chinese digest summary instead of exposing raw English snippets', () => {
    const html = renderStaticDayPage({
      siteTitle: 'AI Pulse Scout',
      targetDate: '2026-05-31',
      homeHref: '../index.html',
      items: [makeItem({
        title: 'Agentic coding workflow improves triage quality',
        summary: 'This raw English summary should not appear on the static page.',
        content_text: 'This raw English snippet should not be shown directly either.',
        key_insight: undefined,
        executive_insight: undefined,
      })],
    });

    expect(html).toContain('今日摘要');
    expect(html).not.toContain('This raw English summary should not appear on the static page.');
  });
});
