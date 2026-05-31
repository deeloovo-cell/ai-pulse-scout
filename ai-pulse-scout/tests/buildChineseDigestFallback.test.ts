import { describe, expect, it } from 'vitest';
import { buildChineseDigestFallback } from '../src/render/buildChineseDigestFallback.js';

describe('buildChineseDigestFallback', () => {
  it('builds a Chinese fallback instead of exposing raw English abstract text', () => {
    const result = buildChineseDigestFallback({
      title: 'AI item',
      source_name: 'arXiv cs.AI',
      primary_topic: 'Research & Papers',
      summary: 'Abstract: This is an English summary.',
      content_text: 'Longer content body.',
      key_insight: undefined,
    } as any);

    expect(result).toContain('这条');
    expect(result).not.toContain('Abstract:');
    expect(result).not.toContain('This is an English summary.');
    expect(result).not.toContain('arXiv');
    expect(result).not.toContain('cs.AI');
  });
});
