import { describe, expect, it } from 'vitest';
import { capDigestItems } from '../src/filtering/capDigestItems.js';

describe('capDigestItems', () => {
  it('caps non-arxiv families at 20 by default', () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      source_name: 'Example Feed',
      source_url: 'https://example.com/feed.xml',
      id: `item-${index + 1}`,
    }));

    expect(capDigestItems(items)).toHaveLength(20);
  });

  it('allows up to 40 arxiv items before fallback fill', () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      source_name: `arXiv cs.${index}`,
      source_url: `https://arxiv.org/abs/2501.${String(index).padStart(4, '0')}`,
      id: `arxiv-${index + 1}`,
    }));

    expect(capDigestItems(items)).toHaveLength(40);
  });
});
