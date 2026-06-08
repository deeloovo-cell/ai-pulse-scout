import type { NormalizedItem } from '../types/item.js';

/**
 * Positive signals — each match adds 1 to the score.
 * Multiple matches indicate stronger AI relevance.
 */
const POSITIVE_PATTERNS = [
  /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|large language model|foundation model|generative ai)\b/i,
  /\b(agent|multi-agent|model routing|prompt|inference|fine-tuning|rag|embedding|vector|multimodal)\b/i,
  /\b(computer vision|vision-language|nlp|natural language|speech model|robot learning|diffusion policy|autonomous robot)\b/i,
  /\b(monitoring ai|ai deployment|model serving|mlops|ai tooling|ai copilot|ai chip|accelerator)\b/i,
];

/**
 * Hard negatives — immediately disqualify the item (score = 0).
 */
const HARD_NEGATIVE_PATTERNS = [
  /\b(no ai|not ai|non-ai|without ai|no ai-specific details|no meaningful ai angle)\b/i,
  /\b(computers and society|technology and workplace change)\b/i,
];

/**
 * Soft negatives — reduce score by 1 but do not eliminate.
 * Items with only soft-negative signals are borderline and rank lower.
 */
const SOFT_NEGATIVE_PATTERNS = [
  /\b(ci\/cd|continuous integration|release automation|frontend build|css|design system)\b/i,
  /\b(workplace technology|digital transformation|technology in society)\b/i,
];

function buildHaystack(item: NormalizedItem): string {
  return [
    item.source_name,
    item.title,
    item.summary,
    item.content_text,
    (item.tags ?? []).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Returns a numeric relevance score for an item:
 *
 *   0          → hard negative or no positive signal; always excluded
 *   1          → weak positive signal, penalised by soft negative; borderline
 *   2+         → clear positive signal; included with confidence
 *
 * This replaces the previous binary `isAiRelevant` gate.  Soft-negative items
 * are no longer silently dropped — they still compete but rank lower, so the
 * cap naturally prefers stronger matches while maintaining a floor of content.
 */
export function scoreAiRelevance(item: NormalizedItem): number {
  const haystack = buildHaystack(item);

  if (HARD_NEGATIVE_PATTERNS.some((p) => p.test(haystack))) return 0;

  const positiveMatches = POSITIVE_PATTERNS.filter((p) => p.test(haystack)).length;
  if (positiveMatches === 0) return 0;

  const softPenalty = SOFT_NEGATIVE_PATTERNS.some((p) => p.test(haystack)) ? 1 : 0;
  return Math.max(0, positiveMatches - softPenalty);
}

/**
 * Returns true for any item with a positive AI signal, ignoring soft negatives.
 * Used as the adaptive fallback floor in capSourceItems when the scored pool
 * is empty (Option C).
 */
export function hasAnyPositiveSignal(item: NormalizedItem): boolean {
  const haystack = buildHaystack(item);
  if (HARD_NEGATIVE_PATTERNS.some((p) => p.test(haystack))) return false;
  return POSITIVE_PATTERNS.some((p) => p.test(haystack));
}
