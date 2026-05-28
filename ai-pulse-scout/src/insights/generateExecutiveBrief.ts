import type { NormalizedItem } from '../types/item.js';
import type { ExecutiveBrief } from '../types/executive.js';
import { requestChatCompletion, resolveLlmClient, type LlmClientConfig } from './chatCompletions.js';
import { parseExecutiveBriefResponse } from './parseExecutiveInsight.js';
import { logger } from '../utils/logger.js';

export const EXECUTIVE_BRIEF_SYSTEM_PROMPT = `You are preparing a daily executive brief for a CIO and Chief AI Officer.
Return ONLY valid JSON with these keys:
{
  "productivity_upside": "one sentence — strongest productivity or efficiency upside from today's signals",
  "adoption_implementation_risk": "one sentence — biggest adoption, integration, or implementation risk to watch",
  "technical_signal": "one sentence — strongest technical or R&D signal from today's items",
  "suggested_action": "one sentence — concrete next step for the technical leadership team"
}
Be specific, avoid hype, focus on technical productivity, efficiency, implementation realism, and practical next actions.`;

export interface ExecutiveBriefOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export async function generateExecutiveBrief(
  items: NormalizedItem[],
  options: ExecutiveBriefOptions = {},
): Promise<ExecutiveBrief | null> {
  if (items.length === 0) return null;

  const client = resolveLlmClient(options);
  if (!client) {
    return buildFallbackBrief(items);
  }

  try {
    const raw = await requestChatCompletion(
      client,
      [
        { role: 'system', content: EXECUTIVE_BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: buildBriefContext(items) },
      ],
      600,
    );
    return parseExecutiveBriefResponse(raw) ?? buildFallbackBrief(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Executive brief generation failed: ${message}`);
    return buildFallbackBrief(items);
  }
}

export function __testOnly_buildBriefContext(items: NormalizedItem[]): string {
  const lines = items.map((item, index) => {
    const insight = item.executive_insight?.why_it_matters ?? item.key_insight ?? item.summary;
    const tags = [
      item.executive_insight?.growth_lever,
      item.executive_insight?.action,
      item.primary_topic,
    ]
      .filter(Boolean)
      .join(' · ');
    return `${index + 1}. [${tags}] ${item.title}\n   ${insight}`;
  });

  return `Today's digest items (${items.length} total):\n\n${lines.join('\n\n')}`;
}

function buildBriefContext(items: NormalizedItem[]): string {
  return __testOnly_buildBriefContext(items);
}

function buildFallbackBrief(items: NormalizedItem[]): ExecutiveBrief {
  const lead = items[0]!;
  const insight = lead.executive_insight?.why_it_matters ?? lead.key_insight ?? lead.summary;

  return {
    productivity_upside: `Review "${lead.title}" for workflow automation or engineering-efficiency gains.`,
    adoption_implementation_risk: 'Validate data quality, system fit, and rollout complexity before any pilot.',
    technical_signal: insight || 'No analyzed technical signal available; review the top digest items directly.',
    suggested_action: 'Assign a short technical review to the platform, AI, or engineering systems lead.',
  };
}
