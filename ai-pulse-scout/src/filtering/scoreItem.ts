import type { NormalizedItem } from '../types/item.js';
import type { ScoringConfig } from '../types/config.js';

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

function scoreFromKeywords(text: string, keywords: string[], maxExpected = 3): number {
  const hits = countKeywords(text, keywords);
  return Math.min(hits / maxExpected, 1.0);
}

export function scoreItem(item: NormalizedItem, config: ScoringConfig): NormalizedItem {
  const searchText = `${item.title} ${item.summary} ${item.content_text}`;

  const ai_engineering = scoreFromKeywords(searchText, config.ai_engineering_keywords, 4);
  const industrial_ai = scoreFromKeywords(searchText, config.industrial_ai_keywords, 3);
  const cad_cae_cam = scoreFromKeywords(searchText, config.cad_cae_cam_keywords, 3);
  const executive_signal = scoreFromKeywords(searchText, config.executive_signal_keywords, 4);
  const aac_relevance = scoreFromKeywords(searchText, config.aac_relevance_keywords, 3);

  const highBoost = countKeywords(searchText, config.high_signal_boost_keywords) * 0.15;
  const lowPenalty = countKeywords(searchText, config.low_signal_penalty_keywords) * 0.2;

  // Category bonus
  const categoryBonus = item.source_category === 'ai_engineering' ? 0.1 : 0;

  const overall = Math.max(
    0,
    Math.min(
      1,
      (ai_engineering * 0.35 + industrial_ai * 0.15 + cad_cae_cam * 0.1 + executive_signal * 0.25 + aac_relevance * 0.15) +
        highBoost +
        categoryBonus -
        lowPenalty,
    ),
  );

  return {
    ...item,
    relevance_scores: { ai_engineering, industrial_ai, cad_cae_cam, executive_signal, aac_relevance, overall },
  };
}

export function scoreItems(items: NormalizedItem[], config: ScoringConfig): NormalizedItem[] {
  return items.map((item) => scoreItem(item, config));
}
