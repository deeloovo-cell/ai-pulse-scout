import { describe, expect, it } from 'vitest';
import { inferPrimaryTopic } from '../src/topics/inferPrimaryTopic.js';

describe('inferPrimaryTopic', () => {
  it('maps OpenAI items to Frontier Model Labs', () => {
    expect(
      inferPrimaryTopic({
        sourceUrl: 'https://openai.com/news/',
        title: 'OpenAI launches new model family',
        content: 'A new frontier model is available.',
      }),
    ).toBe('Frontier Model Labs');
  });

  it('maps robotics items to Robotics & Embodied AI', () => {
    expect(
      inferPrimaryTopic({
        sourceUrl: 'https://www.therobotreport.com/',
        title: 'New robotics platform',
        content: 'Robotics and embodied AI system update.',
      }),
    ).toBe('Robotics & Embodied AI');
  });

  it('falls back to AI News Roundup for unmatched items', () => {
    expect(
      inferPrimaryTopic({
        sourceUrl: 'https://example.com/misc',
        title: 'Interesting AI update',
        content: 'General AI industry note.',
      }),
    ).toBe('AI News Roundup');
  });
});
