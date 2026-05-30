import { describe, expect, it } from 'vitest';
import { renderReviewPage } from '../../src/web/renderReviewPage.js';

describe('renderReviewPage', () => {
  it('renders cards with tags, score, rating controls, and follow-up control', () => {
    const html = renderReviewPage({
      items: [
        {
          itemKey: 'item-1',
          digestDate: '2026-05-30',
          publishedAt: '2026-05-30T10:00:00.000Z',
          title: 'Alpha item',
          excerpt: 'Alpha excerpt',
          itemUrl: 'https://example.com/a',
          sourceName: 'Example',
          topicTags: ['AI'],
          matchScore: 0.92,
          rating: 4,
          followUp: true,
        },
      ],
    });

    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('Alpha item');
    expect(html).toContain('AI');
    expect(html).toContain('92% match');
    expect(html).toContain('data-item-key="item-1"');
    expect(html).toContain('Follow-up');
  });

  it('renders an empty state when no review items exist', () => {
    const html = renderReviewPage({ items: [] });
    expect(html).toContain('No digest items available in the last 5 days.');
  });
});
