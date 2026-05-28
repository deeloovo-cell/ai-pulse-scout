export type GrowthLever = 'Efficiency' | 'Quality' | 'Revenue' | 'Speed' | 'Risk';

export type AppliesTo = 'Design' | 'Process' | 'Shop floor' | 'Supply chain' | 'R&D';

export type ExecutiveAction = 'Monitor' | 'Evaluate pilot' | 'Engage partner';

export type ManufacturingRelevance = 'High' | 'Medium' | 'Low';

export interface ExecutiveInsight {
  why_it_matters: string;
  growth_lever: GrowthLever;
  applies_to: AppliesTo[];
  action: ExecutiveAction;
  manufacturing_relevance?: ManufacturingRelevance;
}

export interface ExecutiveBrief {
  opportunity: string;
  risk: string;
  rd_signal: string;
  suggested_action: string;
}
