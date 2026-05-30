import type { NormalizedItem } from '../types/item.js';
import { TOPIC_LABELS_ZH } from '../topics/topicLabels.js';

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function pickTopicLabel(item: NormalizedItem): string {
  return TOPIC_LABELS_ZH[item.primary_topic] ?? item.primary_topic ?? 'AI 主题';
}

function pickSourceLabel(item: NormalizedItem): string {
  return item.source_name || '来源';
}

function looksEnglish(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

export function buildChineseDigestFallback(item: NormalizedItem): string {
  const topic = pickTopicLabel(item);
  const source = pickSourceLabel(item);
  const detail = item.summary || item.content_text || item.title || '';

  if (!detail) {
    return `这条来自 ${source} 的${topic}更新已进入今日摘要，当前自动提取信息有限，请点击原文查看详情。`;
  }

  if (looksEnglish(detail)) {
    return `这条来自 ${source} 的${topic}更新已进入今日摘要，核心内容与「${truncate(item.title, 60)}」相关；系统已保留原文链接，建议点击查看完整细节。`;
  }

  return `这条来自 ${source} 的${topic}更新重点是：${truncate(detail)}`;
}
