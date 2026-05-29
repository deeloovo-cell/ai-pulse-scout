import { describe, expect, it } from 'vitest';
import { buildChineseDigestFallback } from '../src/render/buildChineseDigestFallback.js';

describe('buildChineseDigestFallback', () => {
  it('prefers summary and returns Chinese wrapper text', () => {
    const result = buildChineseDigestFallback({
      title: 'AI item',
      summary: 'This is an English summary.',
      content_text: 'Longer content body.',
      key_insight: undefined,
    } as any);

    expect(result).toContain('摘要');
    expect(result).toContain('This is an English summary.');
  });
});
