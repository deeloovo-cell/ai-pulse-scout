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
});

describe('renderHtmlEmail', () => {
  it('includes the item title in bold and underlined', () => {
    const html = renderHtmlEmail({ items: [makeItem()], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('<strong><u>Major AI Breakthrough Released</u></strong>');
  });

  it('includes the source link', () => {
    const html = renderHtmlEmail({ items: [makeItem()], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('href="https://example.com/article"');
  });

  it('prefers analyzed key insight over feed summary', () => {
    const html = renderHtmlEmail({
      items: [makeItem({ key_insight: 'This is the analyzed executive insight.' })],
      date: new Date(),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('This is the analyzed executive insight.');
    expect(html).not.toContain('New agentic AI framework for industrial use.');
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
    expect(html).toContain('#f0f7ff');
    expect(html).toContain('#fff8f0');
  });

  it('omits CIO and AAC commentary sections', () => {
    const item = makeItem({ relevance_scores: { ai_engineering: 0.8, industrial_ai: 0.4, cad_cae_cam: 0.3, executive_signal: 0.5, aac_relevance: 0.5, overall: 0.7 } });
    const html = renderHtmlEmail({ items: [item], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).not.toContain('CIO / AI Lead');
    expect(html).not.toContain('Why it matters for AAC');
  });

  it('renders empty digest gracefully', () => {
    const html = renderHtmlEmail({ items: [], date: new Date(), subjectTemplate: 'AI Pulse Scout -- {date}' });
    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('0 items');
  });
});
