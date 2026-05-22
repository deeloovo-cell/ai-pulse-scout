import { describe, expect, it } from 'vitest';
import { parseSourceInbox } from '../src/inbox/parseSourceInbox.js';

describe('parseSourceInbox', () => {
  it('extracts URLs with section and subsection context', () => {
    const markdown = `# Title

## Core AI Engineering & Agentic AI
- https://blog.langchain.dev/

## AI Leaders / Influencers
### Blogs / Personal Sites
- https://karpathy.ai/
`;

    const parsed = parseSourceInbox(markdown);

    expect(parsed).toEqual([
      expect.objectContaining({
        section: 'core_ai_engineering',
        subsection: null,
        url: 'https://blog.langchain.dev/',
      }),
      expect.objectContaining({
        section: 'ai_leaders_blogs',
        subsection: 'Blogs / Personal Sites',
        url: 'https://karpathy.ai/',
      }),
    ]);
  });
});

import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';

describe('buildSourceUniverse', () => {
  it('enriches parsed inbox entries with classification', () => {
    const markdown = `## YouTube Channels\n- https://www.youtube.com/@aiDotEngineer\n`;
    const universe = buildSourceUniverse(markdown);

    expect(universe[0]).toMatchObject({
      url: 'https://www.youtube.com/@aiDotEngineer',
      classification: {
        kind: 'youtube',
        strategy: 'youtube_channel_resolution',
      },
    });
  });
});
