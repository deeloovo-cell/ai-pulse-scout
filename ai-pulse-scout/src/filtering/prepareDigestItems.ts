import type { DigestConfig } from '../types/config.js';
import type { NormalizedItem } from '../types/item.js';
import { capDigestItems } from './capDigestItems.js';
import { dedupeItems } from './dedupeItems.js';
import { selectItems } from './selectItems.js';

export interface PreparedDigestItems {
  deduped: NormalizedItem[];
  ordered: NormalizedItem[];
  selected: NormalizedItem[];
}

export function prepareDigestItems(
  items: NormalizedItem[],
  config: DigestConfig,
  ledgerSeen: Set<string> = new Set<string>(),
): PreparedDigestItems {
  const deduped = dedupeItems(items, ledgerSeen);
  const ordered = selectItems(deduped, config);
  const selected = capDigestItems(ordered, config.max_items);

  return { deduped, ordered, selected };
}
