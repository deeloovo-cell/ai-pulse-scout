import type { NormalizedItem } from '../types/item.js';

const POSITIVE_PATTERNS = [
  /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|large language model|foundation model|generative ai)\b/i,
  /\b(agent|multi-agent|model routing|prompt|inference|fine-tuning|rag|embedding|vector|multimodal)\b/i,
  /\b(computer vision|vision-language|nlp|natural language|speech model|robot learning|diffusion policy|autonomous robot)\b/i,
  /\b(monitoring ai|ai deployment|model serving|mlops|ai tooling|ai copilot|ai chip|accelerator)\b/i,
];

const HARD_NEGATIVE_PATTERNS = [
  /\b(no ai|not ai|non-ai|without ai|no ai-specific details|no meaningful ai angle)\b/i,
  /\b(computers and society|technology and workplace change)\b/i,
];

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

export function isAiRelevant(item: NormalizedItem): boolean {
  const haystack = buildHaystack(item);

  if (HARD_NEGATIVE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  const hasPositiveSignal = POSITIVE_PATTERNS.some((pattern) => pattern.test(haystack));
  if (!hasPositiveSignal) {
    return false;
  }

  if (SOFT_NEGATIVE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  return true;
}
