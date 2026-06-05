import type { NormalizedItem } from '../types/item.js';
import { TOPIC_LABELS_ZH } from '../topics/topicLabels.js';

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function pickTopicLabel(item: NormalizedItem): string {
  return TOPIC_LABELS_ZH[item.primary_topic] ?? item.primary_topic ?? 'AI 主题';
}

function pickSourceLabel(item: NormalizedItem): string {
  const raw = (item.source_name || '').trim();
  if (!raw) return '该来源';

  if (/arxiv/i.test(raw)) return '该研究来源';
  if (/github/i.test(raw)) return '该项目来源';
  if (/hugging\s*face/i.test(raw)) return '该模型来源';
  if (/substack|newsletter/i.test(raw)) return '该通讯来源';

  return '该来源';
}

function looksEnglish(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

export function buildChineseDigestFallback(item: NormalizedItem): string {
  const topic = pickTopicLabel(item);
  const source = pickSourceLabel(item);
  const detail = item.summary || item.content_text || item.title || '';

  if (!detail) {
    return `这条${topic}更新已进入今日摘要，当前自动提取信息有限；系统已保留原文链接，建议点击查看完整细节。`;
  }

  if (looksEnglish(detail)) {
    return `这条${source}的${topic}更新主要讨论「${truncate(item.title, 60)}」；当前先保留来源关键信息，建议点击查看完整细节。`;
  }

  return `这条${source}的${topic}更新重点是：${truncate(detail)}`;
}
