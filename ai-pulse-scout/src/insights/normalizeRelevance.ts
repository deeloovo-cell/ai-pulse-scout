import type { BusinessDomain } from '../types/executive.js';
import type { NormalizedItem } from '../types/item.js';

export interface NormalizedRelevanceDomain {
  label: BusinessDomain;
  strength: 'high' | 'medium' | 'low';
  evidence: 'content' | 'metadata' | 'inferred';
}

export interface NormalizedRelevance {
  matchedTopics: string[];
  matchedBusinessDomains: NormalizedRelevanceDomain[];
  manufacturingRelevance?: 'high' | 'medium' | 'low';
  recommendedAction?: string;
  overallStrength: 'high' | 'medium' | 'low';
}

type RelevanceInput = Pick<NormalizedItem, 'primary_topic' | 'title' | 'summary' | 'tags' | 'executive_insight'>;

const DOMAIN_ALIASES: Record<string, BusinessDomain> = {
  'r&d': '研发',
  'research and development': '研发',
  '研发': '研发',
  'design': '研发',
  'process': '生产',
  'shop floor': '生产',
  '生产': '生产',
  'quality': '质量',
  '质量': '质量',
  'supply chain': '供应链',
  'supply-chain': '供应链',
  '供应链': '供应链',
  'sales': '销售',
  '销售': '销售',
  'finance': '财务',
  '财务': '财务',
  'hr': '人事',
  'human resources': '人事',
  '人事': '人事',
  'planning': '计划',
  '计划': '计划',
};

const INCLUDED_TOPICS = ['智能体', '多模态', '大模型', '计算机视觉', '机器人', 'AI 基础设施'] as const;

function normalizeDomain(value: string): BusinessDomain | null {
  return DOMAIN_ALIASES[value.trim().toLowerCase()] ?? null;
}

function normalizeRelevanceLevel(value?: string): 'high' | 'medium' | 'low' | undefined {
  if (!value) return undefined;
  const lowered = value.toLowerCase();
  if (lowered === 'high') return 'high';
  if (lowered === 'medium') return 'medium';
  if (lowered === 'low') return 'low';
  return undefined;
}

function inferTopics(item: RelevanceInput): string[] {
  const corpus = `${item.primary_topic} ${item.title} ${item.summary} ${(item.tags ?? []).join(' ')}`.toLowerCase();
  const matched: string[] = [];

  const tryAdd = (label: string, pattern: RegExp) => {
    if (pattern.test(corpus) && !matched.includes(label)) {
      matched.push(label);
    }
  };

  tryAdd('智能体', /(agent|agentic|workflow|tool use|tools)/i);
  tryAdd('多模态', /(multimodal|multi-modal|vision-language|vlm)/i);
  tryAdd('大模型', /(llm|language model|gpt|reasoning|transformer)/i);
  tryAdd('计算机视觉', /(vision|image|video|segmentation|detection)/i);
  tryAdd('机器人', /(robot|robotics|embodied)/i);
  tryAdd('AI 基础设施', /(infrastructure|training|serving|deployment|system|compute)/i);

  if (matched.length > 0) return matched;

  const topicMap: Record<string, string[]> = {
    'AI Developer Tools & Agents': ['智能体', 'AI 基础设施'],
    'Robotics & Embodied AI': ['机器人'],
    'Industrial / Manufacturing AI': ['AI 基础设施'],
    'Research & Papers': ['大模型'],
  };

  return (topicMap[item.primary_topic] ?? []).filter((label) => INCLUDED_TOPICS.includes(label as (typeof INCLUDED_TOPICS)[number]));
}

export function normalizeRelevance(item: RelevanceInput): NormalizedRelevance {
  const contentDomains = (item.executive_insight?.business_domains ?? [])
    .map((value) => normalizeDomain(value))
    .filter((value): value is BusinessDomain => Boolean(value));

  const metadataDomains = (item.executive_insight?.applies_to ?? [])
    .map((value) => normalizeDomain(value))
    .filter((value): value is BusinessDomain => Boolean(value));

  const manufacturingRelevance = normalizeRelevanceLevel(item.executive_insight?.manufacturing_relevance);
  const preferredDomains = contentDomains.length > 0
    ? contentDomains
    : manufacturingRelevance === 'low'
      ? []
      : metadataDomains;

  const seen = new Set<BusinessDomain>();
  const matchedBusinessDomains = preferredDomains
    .filter((domain) => {
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    })
    .slice(0, 3)
    .map((label) => ({
      label,
      strength: contentDomains.includes(label) ? 'high' as const : 'medium' as const,
      evidence: contentDomains.includes(label) ? 'content' as const : 'metadata' as const,
    }));

  const overallStrength = manufacturingRelevance ?? (matchedBusinessDomains.length > 0 ? 'medium' : 'low');

  return {
    matchedTopics: inferTopics(item),
    matchedBusinessDomains,
    manufacturingRelevance,
    recommendedAction: item.executive_insight?.action,
    overallStrength,
  };
}
