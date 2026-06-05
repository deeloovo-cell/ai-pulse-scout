import { describe, expect, it } from 'vitest';
import { normalizeRelevance } from '../src/insights/normalizeRelevance.js';

describe('normalizeRelevance', () => {
  it('deduplicates legacy and chinese business-domain labels', () => {
    const result = normalizeRelevance({
      primary_topic: 'AI Developer Tools & Agents',
      title: 'Agent orchestration update',
      summary: 'Improves enterprise workflow automation.',
      tags: ['agentic'],
      executive_insight: {
        why_it_matters: '和研发流程自动化有关。',
        growth_lever: 'Efficiency',
        applies_to: ['R&D', 'Supply chain'],
        action: 'Monitor',
        manufacturing_relevance: 'High',
        source_summary: '这是一条关于 agent 编排的更新。',
        business_domains: ['研发', '供应链'],
      },
    } as any);

    expect(result.matchedBusinessDomains.map((entry) => entry.label)).toEqual(['研发', '供应链']);
  });

  it('filters excluded interest drivers even when topic badges mention them', () => {
    const result = normalizeRelevance({
      primary_topic: 'Research & Papers',
      title: 'Biotech model benchmark',
      summary: 'Drug discovery benchmark update.',
      tags: ['biotech', 'climate'],
      executive_insight: {
        why_it_matters: '偏前沿研究。',
        growth_lever: 'Efficiency',
        applies_to: ['R&D'],
        action: 'Monitor',
        manufacturing_relevance: 'Low',
        source_summary: '这是一篇 benchmark 论文。',
        business_domains: [],
      },
    } as any);

    expect(result.matchedTopics).not.toContain('生物医药');
    expect(result.matchedTopics).not.toContain('气候科技');
  });

  it('prefers source-grounded domain evidence over conflicting legacy applies_to labels', () => {
    const result = normalizeRelevance({
      primary_topic: 'Industrial / Manufacturing AI',
      title: 'Visual inspection rollout',
      summary: 'Targets defect detection on production lines.',
      tags: [],
      executive_insight: {
        why_it_matters: '对质量控制更直接。',
        growth_lever: 'Quality',
        applies_to: ['R&D'],
        action: 'Evaluate pilot',
        manufacturing_relevance: 'High',
        source_summary: '产线视觉质检方案。',
        business_domains: ['质量', '生产'],
      },
    } as any);

    expect(result.matchedBusinessDomains.map((entry) => entry.label)).toEqual(['质量', '生产']);
    expect(result.overallStrength).toBe('high');
  });

  it('marks weak relevance without forcing broad business-domain coverage', () => {
    const result = normalizeRelevance({
      primary_topic: 'Research & Papers',
      title: 'LLM quantization benchmark',
      summary: 'Pure infrastructure benchmark with weak manufacturing mapping.',
      tags: ['llm'],
      executive_insight: {
        why_it_matters: '更适合作为前沿能力信号。',
        growth_lever: 'Efficiency',
        applies_to: ['R&D'],
        action: 'Monitor',
        manufacturing_relevance: 'Low',
        source_summary: '这是一篇量化 benchmark。',
        business_domains: [],
      },
    } as any);

    expect(result.matchedBusinessDomains).toEqual([]);
    expect(result.overallStrength).toBe('low');
  });
});
