import { describe, expect, it } from 'vitest';
import { selectDailyDigestItems } from '../src/filtering/selectDailyDigestItems.js';

function makeItem(id: string, topic: string, hour: string) {
  return {
    id,
    title: id,
    primary_topic: topic,
    published_at: new Date(`2026-05-29T${hour}:00:00.000Z`),
    fetched_at: new Date(`2026-05-29T${hour}:01:00.000Z`),
    item_url: `https://example.com/${id}`,
    source_name: 'Test',
    content_text: 'body',
    summary: 'summary',
    tags: [],
    rawMetadata: {},
  } as any;
}

describe('selectDailyDigestItems', () => {
  it('returns all items while preserving topic coverage', () => {
    const ordered = [
      makeItem('a1', 'AI Products & Platforms', '09'),
      makeItem('b1', 'Research & Papers', '08'),
      makeItem('a2', 'AI Products & Platforms', '07'),
      makeItem('c1', 'AI Developer Tools & Agents', '06'),
    ];

    const result = selectDailyDigestItems(ordered);

    expect(result.map((item) => item.id)).toEqual(['a1', 'b1', 'c1', 'a2']);
    expect(new Set(result.map((item) => item.primary_topic))).toEqual(
      new Set(['AI Products & Platforms', 'Research & Papers', 'AI Developer Tools & Agents']),
    );
  });
});
