import type { NormalizedItem } from '../types/item.js';

function truncate(text: string, max = 220): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function buildChineseDigestFallback(item: NormalizedItem): string {
  const base = item.key_insight || item.summary || item.content_text || '该条目暂无足够摘要信息，请点击原文查看。';
  return `摘要：${truncate(base)}`;
}
