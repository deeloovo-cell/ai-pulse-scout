import { describe, it, expect } from 'vitest';
import { buildSubject, renderHtmlEmail } from '../src/render/renderHtmlEmail.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'test-id',
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com',
    item_url: 'https://example.com/article',
    title: 'Major AI Breakthrough Released',
    published_at: new Date('2026-05-20T10:00:00Z'),
    fetched_at: new Date(),
    author: 'AI Researcher',
    content_text: 'This article describes a new agentic AI framework with industrial applications.',
    summary: 'New agentic AI framework for industrial use.',
    tags: [],
    content_type: 'article',
    fingerprint: 'abc123def456abcd',
    relevance_scores: { ai_engineering: 0.8, industrial_ai: 0.3, cad_cae_cam: 0, executive_signal: 0.5, aac_relevance: 0.1, overall: 0.6 },
    decision: 'include',
    decision_reason: 'score=0.60',
    primary_topic: 'AI Developer Tools & Agents',
    ...overrides,
  };
}

describe('buildSubject', () => {
  it('formats subject with date placeholder', () => {
    const date = new Date('2026-05-21T07:00:00Z');
    const subject = buildSubject('AI Pulse Scout -- {date}', date);
    expect(subject).toBe('AI Pulse Scout -- 05-21-2026');
  });

  it('handles custom template', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    expect(buildSubject('Digest {date}', date)).toBe('Digest 01-15-2026');
  });

  it('formats subject with item count placeholder', () => {
    const date = new Date('2026-05-28T12:00:00Z');
    const subject = buildSubject('AI Pulse Scout — {date} | {count} signals', date, 3);
    expect(subject).toBe('AI Pulse Scout — 05-28-2026 | 3 signals');
  });
});

describe('renderHtmlEmail', () => {
  it('restores AI Pulse Scout brand and renders chinese daily framing', () => {
    const html = renderHtmlEmail({
      items: [makeItem()],
      date: new Date('2026-05-28T12:00:00Z'),
      subjectTemplate: 'AI Pulse Scout — {date} | {count} signals',
      executiveBrief: null,
    });
    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('今日 AI 情报');
    expect(html).not.toContain('Manufacturing AI Pulse');
    expect(html).not.toContain('CIO / Chief AI Officer brief');
    expect(html).toContain('border-top:2px solid');
  });

  it('includes the item title link', () => {
    const html = renderHtmlEmail({ items: [makeItem()], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('Major AI Breakthrough Released');
    expect(html).toContain('href="https://example.com/article"');
  });

  it('renders the two-part summary in html outputs without changing card structure', () => {
    const html = renderHtmlEmail({
      items: [makeItem({
        executive_insight: {
          why_it_matters: '这对研发流程自动化更值得关注。',
          growth_lever: 'Efficiency',
          applies_to: ['R&D'],
          action: 'Monitor',
          manufacturing_relevance: 'High',
          source_summary: '这条更新介绍了新的 agent 编排框架。',
          business_domains: ['研发'],
        },
        key_insight: '这对研发流程自动化更值得关注。',
      })],
      date: new Date(),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('这条更新介绍了新的 agent 编排框架。');
    expect(html).toContain('相关业务域：研发');
    expect(html).toContain('digest-summary');
  });

  it('escapes HTML entities in title', () => {
    const item = makeItem({ title: 'Attack <script>alert(1)</script> & more' });
    const html = renderHtmlEmail({ items: [item], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('uses alternating background colors for multiple items', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b', item_url: 'https://example.com/b', fingerprint: 'fp2' })];
    const html = renderHtmlEmail({ items, date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('#f4f8fc');
    expect(html).toContain('#faf6f0');
  });

  it('renders productivity-oriented executive brief labels', () => {
    const html = renderHtmlEmail({
      items: [makeItem()],
      date: new Date('2026-05-28T12:00:00Z'),
      subjectTemplate: 'AI Pulse Scout — {date} | {count} signals',
      executiveBrief: {
        productivity_upside: 'Reduce repetitive engineering review time.',
        adoption_implementation_risk: 'ERP integration quality may slow rollout.',
        technical_signal: 'A stronger agent-eval pattern is emerging.',
        suggested_action: 'Review the top two items with the platform lead.',
      },
    });

    expect(html).toContain('Productivity upside');
    expect(html).toContain('Adoption / implementation risk');
    expect(html).toContain('Technical signal');
    expect(html).toContain('Suggested action');
    expect(html).not.toContain('Opportunity');
    expect(html).not.toContain('Risk / watch');
  });

  it('omits CIO and AAC commentary sections', () => {
    const item = makeItem({ relevance_scores: { ai_engineering: 0.8, industrial_ai: 0.4, cad_cae_cam: 0.3, executive_signal: 0.5, aac_relevance: 0.5, overall: 0.7 } });
    const html = renderHtmlEmail({ items: [item], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).not.toContain('CIO / AI Lead');
    expect(html).not.toContain('Why it matters for AAC');
  });

  it('renders chinese topic headings before grouped items', () => {
    const html = renderHtmlEmail({
      items: [
        makeItem({
          id: 'frontier',
          item_url: 'https://example.com/frontier',
          fingerprint: 'frontier-fp',
          primary_topic: 'Frontier Model Labs',
          title: 'Model release',
        }),
        makeItem({
          id: 'tools',
          item_url: 'https://example.com/tools',
          fingerprint: 'tools-fp',
          primary_topic: 'AI Developer Tools & Agents',
          title: 'Agent framework update',
        }),
      ],
      date: new Date(),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('前沿模型实验室');
    expect(html).toContain('AI 开发工具与 Agents');
  });

  it('renders localized executive-insight labels in chinese', () => {
    const html = renderHtmlEmail({
      items: [
        makeItem({
          executive_insight: {
            why_it_matters: '这项更新会影响制造企业对 agent 系统的部署节奏。',
            growth_lever: 'Efficiency',
            applies_to: ['R&D', 'Process'],
            action: 'Evaluate pilot',
            manufacturing_relevance: 'High',
          },
          key_insight: '这项更新会影响制造企业对 agent 系统的部署节奏。',
        }),
      ],
      date: new Date(),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('效率');
    expect(html).toContain('研发、流程');
    expect(html).toContain('评估试点');
    expect(html).toContain('制造相关性：高');
  });

  it('renders empty digest gracefully in chinese', () => {
    const html = renderHtmlEmail({ items: [], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('当前时间窗内没有新的 AI 情报');
  });
});
