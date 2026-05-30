import type { DigestTopic } from '../types/item.js';

export interface TopicInferenceInput {
  sourceUrl: string;
  title: string;
  content: string;
}

export function inferPrimaryTopic(input: TopicInferenceInput): DigestTopic {
  const haystack = `${input.sourceUrl} ${input.title} ${input.content}`.toLowerCase();

  if (/(arxiv\.org\/rss\/cs\.(ce|cg|gr)|computational engineering|cad\/cam|\bcad\b|\bcam\b|manufacturing feature|process planning|capp\b)/.test(haystack)) {
    return 'Industrial / Manufacturing AI';
  }

  if (/(arxiv\.org\/rss\/(cs\.ro|cs\.sy)|eess\.sy|robot|robotics|embodied|sim-to-real|sim2real|isaac|ros\b|cyber-physical)/.test(haystack)) {
    return 'Robotics & Embodied AI';
  }

  if (/(manufacturing|industrial|siemens|ptc|autodesk|ansys|hexagon|iiot|factory|shop floor)/.test(haystack)) {
    return 'Industrial / Manufacturing AI';
  }

  if (/(openai|anthropic|deepmind|google deepmind|frontier model|claude|gpt)/.test(haystack)) {
    return 'Frontier Model Labs';
  }

  if (/(langchain|langgraph|autogen|agent sdk|mcp|model context protocol|developer tool|agent framework)/.test(haystack)) {
    return 'AI Developer Tools & Agents';
  }

  if (/(arxiv|paper|benchmark|research)/.test(haystack)) {
    return 'Research & Papers';
  }

  if (/(robot|robotics|embodied|isaac|ros|open robotics|boston dynamics)/.test(haystack)) {
    return 'Robotics & Embodied AI';
  }

  if (/(platform|product|cloud|enterprise ai|api launch|service)/.test(haystack)) {
    return 'AI Products & Platforms';
  }

  if (/(reddit|hacker news|community|market signal|newsletter|semianalysis)/.test(haystack)) {
    return 'Community & Market Signals';
  }

  return 'AI News Roundup';
}
