export type GrowthLever = 'Efficiency' | 'Quality' | 'Revenue' | 'Speed' | 'Risk';

export type AppliesTo = 'Design' | 'Process' | 'Shop floor' | 'Supply chain' | 'R&D';

export type ExecutiveAction = 'Monitor' | 'Evaluate pilot' | 'Engage partner';

export type ManufacturingRelevance = 'High' | 'Medium' | 'Low';

export type BusinessDomain =
  | '销售'
  | '研发'
  | '生产'
  | '质量'
  | '人事'
  | '财务'
  | '供应链'
  | '计划';

export interface ExecutiveInsight {
  why_it_matters: string;
  growth_lever: GrowthLever;
  applies_to: AppliesTo[];
  action: ExecutiveAction;
  manufacturing_relevance?: ManufacturingRelevance;
  source_summary?: string;
  business_domains?: BusinessDomain[];
}

export interface ExecutiveBrief {
  productivity_upside: string;
  adoption_implementation_risk: string;
  technical_signal: string;
  suggested_action: string;
}
