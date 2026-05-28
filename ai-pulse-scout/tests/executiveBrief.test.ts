import { describe, expect, test } from 'vitest';
import { parseExecutiveBriefResponse } from '../src/insights/parseExecutiveInsight.js';
import {
  __testOnly_buildBriefContext,
  EXECUTIVE_BRIEF_SYSTEM_PROMPT,
  generateExecutiveBrief,
} from '../src/insights/generateExecutiveBrief.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(index: number): NormalizedItem {
  return {
    id: `id-${index}`,
    source_name: 'Example',
    source_category: 'ai_engineering',
    source_url: 'https://source.example.com',
    item_url: `https://example.com/${index}`,
    title: `Signal ${index}`,
    published_at: new Date('2026-05-28T12:00:00Z'),
    fetched_at: new Date(),
    author: 'Example Author',
    content_text: `Content ${index}`,
    summary: `Summary ${index}`,
    key_insight: `Insight ${index}`,
    tags: [],
    content_type: 'article',
    fingerprint: `fingerprint-${index}`,
    relevance_scores: { ai_engineering: 0.8, industrial_ai: 0.3, cad_cae_cam: 0, executive_signal: 0.5, aac_relevance: 0.1, overall: 0.6 },
    decision: 'include',
    decision_reason: 'score=0.60',
    primary_topic: 'AI Developer Tools & Agents',
  };
}

describe('executive brief parsing', () => {
  test('parses productivity-oriented JSON keys', () => {
    const parsed = parseExecutiveBriefResponse(`{
      "productivity_upside": "Reduce repetitive review work.",
      "adoption_implementation_risk": "Data cleanup may slow deployment.",
      "technical_signal": "A stronger multimodal extraction pattern is visible.",
      "suggested_action": "Run a focused architecture review."
    }`);

    expect(parsed).toEqual({
      productivity_upside: 'Reduce repetitive review work.',
      adoption_implementation_risk: 'Data cleanup may slow deployment.',
      technical_signal: 'A stronger multimodal extraction pattern is visible.',
      suggested_action: 'Run a focused architecture review.',
    });
  });

  test('falls back to productivity-oriented brief when no client is configured', async () => {
    const brief = await generateExecutiveBrief([makeItem(1)], { apiKey: '' });

    expect(brief?.productivity_upside).toContain('automation');
    expect(brief?.adoption_implementation_risk).toContain('rollout');
    expect(brief?.technical_signal).toContain('Insight 1');
  });

  test('includes every selected item instead of truncating at 12', () => {
    const items = Array.from({ length: 14 }, (_, i) => makeItem(i + 1));
    const context = __testOnly_buildBriefContext(items);

    expect(context).toContain('Signal 1');
    expect(context).toContain('Signal 12');
    expect(context).toContain('Signal 13');
    expect(context).toContain('Signal 14');
    expect(context).toContain('14 total');
    expect(context).not.toContain('showing up to 12');
  });

  test('uses productivity and implementation oriented brief instructions', () => {
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('CIO and Chief AI Officer');
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('technical productivity');
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('implementation');
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('productivity_upside');
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).not.toContain('growth upside');
    expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).not.toContain('manufacturing growth enablement');
  });
});
