import type { NormalizedItem } from '../types/item.js';

export function selectDailyDigestItems(items: NormalizedItem[]): NormalizedItem[] {
  const seenTopics = new Set<string>();
  const guaranteed: NormalizedItem[] = [];
  const rest: NormalizedItem[] = [];

  for (const item of items) {
    const topic = item.primary_topic;
    if (!seenTopics.has(topic)) {
      seenTopics.add(topic);
      guaranteed.push(item);
    } else {
      rest.push(item);
    }
  }

  const included = new Set(guaranteed.map((item) => item.id));
  return items.filter((item) => included.has(item.id)).concat(rest.filter((item) => !included.has(item.id)));
}
