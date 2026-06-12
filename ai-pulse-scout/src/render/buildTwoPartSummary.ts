import { normalizeRelevance } from '../insights/normalizeRelevance.js';
import type { NormalizedItem } from '../types/item.js';
import { buildChineseDigestFallback } from './buildChineseDigestFallback.js';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function pickParagraphOne(item: NormalizedItem): string {
  const explicit = item.executive_insight?.source_summary?.trim();
  if (explicit) {
    return explicit;
  }
  const keyInsight = item.key_insight?.trim();
  if (keyInsight) {
    return keyInsight;
  }
  return buildChineseDigestFallback(item);
}

function buildParagraphTwo(item: NormalizedItem, paragraphOne: string): string {
  const normalized = normalizeRelevance(item);
  const domains = normalized.matchedBusinessDomains.map((entry) => entry.label).slice(0, 3);

  if (normalized.overallStrength === 'low' || domains.length === 0) {
    return '这条更适合作为前沿技术信号跟踪，与当前关注业务域的直接相关性有限。';
  }

  const rawLead = normalizeWhitespace(item.executive_insight?.why_it_matters ?? '这条更新对当前业务关注方向存在直接关联。');
  const shouldCompressLead = /(销售、研发、生产、质量、人事、财务、供应链、计划|都有影响|都有帮助)/.test(rawLead);
  const dedupLead = rawLead === paragraphOne ? '这条更新对当前业务关注方向存在直接关联。' : rawLead;
  const safeLead = shouldCompressLead ? '这条更新对当前业务流程有较直接的参考价值。' : dedupLead;
  return `${safeLead} 相关业务域：${domains.join('、')}。`;
}

export function buildTwoPartSummary(item: NormalizedItem): string {
  const paragraphOne = normalizeWhitespace(pickParagraphOne(item));
  const paragraphTwo = normalizeWhitespace(buildParagraphTwo(item, paragraphOne));
  return `${paragraphOne}\n\n${paragraphTwo}`;
}
