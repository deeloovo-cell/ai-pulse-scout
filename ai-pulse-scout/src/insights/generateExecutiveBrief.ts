import type { NormalizedItem } from '../types/item.js';
import type { ExecutiveBrief } from '../types/executive.js';
import { requestChatCompletion, resolveLlmClient, type LlmClientConfig } from './chatCompletions.js';
import { parseExecutiveBriefResponse } from './parseExecutiveInsight.js';
import { logger } from '../utils/logger.js';

const ITEM_SYSTEM_PROMPT = `You are preparing a daily executive brief for a CIO and Chief AI Officer at a high-tech manufacturing company.
Return ONLY valid JSON with these keys:
{
  "opportunity": "one sentence — highest growth upside from today's signals",
  "risk": "one sentence — top risk or watch item",
  "rd_signal": "one sentence — strongest R&D or technology signal",
  "suggested_action": "one sentence — concrete next step for leadership"
}
Be specific, avoid hype, focus on manufacturing growth enablement.`;

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
        { role: 'system', content: ITEM_SYSTEM_PROMPT },
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

function buildBriefContext(items: NormalizedItem[]): string {
  const lines = items.slice(0, 12).map((item, index) => {
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

  return `Today's digest items (${items.length} total, showing up to 12):\n\n${lines.join('\n\n')}`;
}

function buildFallbackBrief(items: NormalizedItem[]): ExecutiveBrief {
  const lead = items[0]!;
  const insight = lead.executive_insight?.why_it_matters ?? lead.key_insight ?? lead.summary;

  return {
    opportunity: `Review "${lead.title}" for potential manufacturing or product impact.`,
    risk: 'Automated brief only — validate vendor claims and safety implications before pilots.',
    rd_signal: insight || 'No analyzed insight available; open top items in the digest.',
    suggested_action: 'Assign a 30-minute review to your digital manufacturing or AI platform lead.',
  };
}
