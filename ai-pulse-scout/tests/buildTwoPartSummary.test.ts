import { describe, expect, it } from 'vitest';
import { buildTwoPartSummary } from '../src/render/buildTwoPartSummary.js';

describe('buildTwoPartSummary', () => {
  it('returns exactly two paragraphs with source summary first', () => {
    const text = buildTwoPartSummary({
      title: 'Agent update',
      summary: 'English feed summary',
      content_text: 'Longer body',
      primary_topic: 'AI Developer Tools & Agents',
      tags: ['agentic'],
      executive_insight: {
        why_it_matters: '这对研发流程自动化和供应链协同更值得关注。',
        growth_lever: 'Efficiency',
        applies_to: ['R&D'],
        action: 'Monitor',
        manufacturing_relevance: 'High',
        source_summary: '这条更新介绍了一个新的 agent 编排框架。',
        business_domains: ['研发', '供应链'],
      },
    } as any);

    const paragraphs = text.split('\n\n');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain('新的 agent 编排框架');
    expect(paragraphs[1]).toContain('相关业务域：研发、供应链');
  });

  it('uses limited-relevance wording for weakly related technical items', () => {
    const text = buildTwoPartSummary({
      title: 'Quantization benchmark',
      summary: 'Infra-only item',
      content_text: 'Low-level benchmark',
      primary_topic: 'Research & Papers',
      tags: ['llm'],
      executive_insight: {
        why_it_matters: '更适合作为前沿能力信号。',
        growth_lever: 'Efficiency',
        applies_to: ['R&D'],
        action: 'Monitor',
        manufacturing_relevance: 'Low',
        source_summary: '这是一篇量化 benchmark 报告。',
        business_domains: [],
      },
    } as any);

    expect(text).toContain('直接相关性有限');
    expect(text).not.toContain('销售、研发、生产、质量、人事、财务、供应链、计划');
  });

  it('caps business-domain mentions at three and avoids repeating paragraph one', () => {
    const text = buildTwoPartSummary({
      title: 'Manufacturing platform update',
      summary: 'Factory operations platform',
      content_text: 'Factory operations platform',
      primary_topic: 'Industrial / Manufacturing AI',
      tags: [],
      executive_insight: {
        why_it_matters: '对生产、质量、供应链、计划都有影响。',
        growth_lever: 'Quality',
        applies_to: ['Process', 'Supply chain'],
        action: 'Evaluate pilot',
        manufacturing_relevance: 'High',
        source_summary: '这条更新聚焦工厂运营平台能力。',
        business_domains: ['生产', '质量', '供应链', '计划'],
      },
    } as any);

    const [, paragraph2] = text.split('\n\n');
    expect(paragraph2).toContain('相关业务域：');
    expect(paragraph2).not.toContain('生产、质量、供应链、计划');
  });
});
