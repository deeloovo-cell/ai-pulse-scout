import type {
  AppliesTo,
  BusinessDomain,
  ExecutiveAction,
  ExecutiveBrief,
  ExecutiveInsight,
  GrowthLever,
  ManufacturingRelevance,
} from '../types/executive.js';

const GROWTH_LEVERS: GrowthLever[] = ['Efficiency', 'Quality', 'Revenue', 'Speed', 'Risk'];
const APPLIES_TO: AppliesTo[] = ['Design', 'Process', 'Shop floor', 'Supply chain', 'R&D'];
const ACTIONS: ExecutiveAction[] = ['Monitor', 'Evaluate pilot', 'Engage partner'];
const RELEVANCE: ManufacturingRelevance[] = ['High', 'Medium', 'Low'];
const BUSINESS_DOMAINS: BusinessDomain[] = ['销售', '研发', '生产', '质量', '人事', '财务', '供应链', '计划'];

export function parseExecutiveInsightResponse(raw: string): ExecutiveInsight | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const why = asString(parsed.why_it_matters);
    if (!why) return null;

    return {
      why_it_matters: why,
      growth_lever: pickEnum(parsed.growth_lever, GROWTH_LEVERS, 'Efficiency'),
      applies_to: pickAppliesTo(parsed.applies_to),
      action: pickEnum(parsed.action, ACTIONS, 'Monitor'),
      manufacturing_relevance: pickOptionalEnum(parsed.manufacturing_relevance, RELEVANCE),
      source_summary: asString(parsed.source_summary) ?? undefined,
      business_domains: pickBusinessDomains(parsed.business_domains),
    };
  } catch {
    return null;
  }
}

export function parseExecutiveBriefResponse(raw: string): ExecutiveBrief | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const productivity_upside = asString(parsed.productivity_upside);
    const adoption_implementation_risk = asString(parsed.adoption_implementation_risk);
    const technical_signal = asString(parsed.technical_signal);
    const suggested_action = asString(parsed.suggested_action);
    if (!productivity_upside || !adoption_implementation_risk || !technical_signal || !suggested_action) return null;

    return { productivity_upside, adoption_implementation_risk, technical_signal, suggested_action };
  } catch {
    return null;
  }
}

export function defaultExecutiveInsight(fallbackText: string, isPaper: boolean): ExecutiveInsight {
  return {
    why_it_matters: fallbackText,
    growth_lever: 'Efficiency',
    applies_to: ['R&D'],
    action: 'Monitor',
    manufacturing_relevance: isPaper ? 'Medium' : undefined,
  };
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);

  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== 'string') return fallback;
  const match = allowed.find((entry) => entry.toLowerCase() === value.toLowerCase());
  return match ?? fallback;
}

function pickOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return allowed.find((entry) => entry.toLowerCase() === value.toLowerCase());
}

function pickAppliesTo(value: unknown): AppliesTo[] {
  if (!Array.isArray(value)) return ['R&D'];
  const picked = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => APPLIES_TO.find((allowed) => allowed.toLowerCase() === entry.toLowerCase()))
    .filter((entry): entry is AppliesTo => Boolean(entry));
  return picked.length > 0 ? picked.slice(0, 2) : ['R&D'];
}

function pickBusinessDomains(value: unknown): BusinessDomain[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const picked = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => BUSINESS_DOMAINS.find((allowed) => allowed === entry.trim()))
    .filter((entry): entry is BusinessDomain => Boolean(entry));
  return picked.length > 0 ? picked.slice(0, 3) : undefined;
}
