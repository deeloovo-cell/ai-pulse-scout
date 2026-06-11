import type { NormalizedItem } from '../types/item.js';
import { buildTwoPartSummary } from '../render/buildTwoPartSummary.js';

interface StaticPageInput {
  siteTitle: string;
  targetDate: string;
  items: NormalizedItem[];
}

interface StaticIndexPageInput extends StaticPageInput {}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getPreferredSummary(item: NormalizedItem): string {
  return truncateText(normalizeWhitespace(buildTwoPartSummary(item)), 360);
}

function inferTopicBadges(item: NormalizedItem): string[] {
  const corpus = `${item.primary_topic} ${item.title} ${item.summary ?? ''} ${item.content_text} ${item.tags.join(' ')}`.toLowerCase();
  const badges: string[] = [];

  const tryAdd = (label: string, pattern: RegExp) => {
    if (badges.length < 2 && pattern.test(corpus) && !badges.includes(label)) {
      badges.push(label);
    }
  };

  tryAdd('智能体', /(agent|agentic|workflow|tool use|tools)/i);
  tryAdd('多模态', /(multimodal|multi-modal|vision-language|vlm)/i);
  tryAdd('大模型', /(llm|language model|gpt|reasoning|transformer)/i);
  tryAdd('计算机视觉', /(vision|image|video|segmentation|detection)/i);
  tryAdd('机器人', /(robot|robotics|embodied)/i);
  tryAdd('生物医药', /(protein|drug|biotech|genomics|biomedical)/i);
  tryAdd('气候科技', /(climate|energy|carbon)/i);
  tryAdd('AI 基础设施', /(infrastructure|training|serving|deployment|system|compute)/i);

  if (badges.length === 0) {
    const topicMap: Record<string, string[]> = {
      'AI Developer Tools & Agents': ['智能体', 'AI 基础设施'],
      'Foundation Models & LLMs': ['大模型'],
      'Robotics & Embodied AI': ['机器人'],
      'Computer Vision & Multimodal': ['多模态', '计算机视觉'],
      'Biotech & Health AI': ['生物医药'],
      'Climate & Energy Tech': ['气候科技'],
    };

    for (const label of topicMap[item.primary_topic] ?? ['AI 基础设施']) {
      if (badges.length < 2 && !badges.includes(label)) {
        badges.push(label);
      }
    }
  }

  return badges.slice(0, 2);
}

function getRelevantRank(item: NormalizedItem): string {
  const score = item.relevance_scores?.overall ?? 0;
  if (score >= 0.9) {
    return '★★★★★';
  }
  if (score >= 0.8) {
    return '★★★★☆';
  }
  if (score >= 0.7) {
    return '★★★☆☆';
  }
  return '★★☆☆☆';
}

function renderItems(items: NormalizedItem[]): string {
  if (items.length === 0) {
    return '<div class="empty-state">当前没有可展示的 digest 内容。</div>';
  }

  return items.map((item) => {
    const badges = inferTopicBadges(item);
    const summary = getPreferredSummary(item);
    const relevantRank = getRelevantRank(item);
    return `
    <article class="digest-card">
      <div class="card-top">
        <span class="rank-pill">Relevant rank ${relevantRank}</span>
        <div class="topic-badges">${badges.map((badge) => `<span class="topic-badge">${escapeHtml(badge)}</span>`).join('')}</div>
      </div>
      <h2 class="digest-title">
        <a href="${escapeHtml(item.item_url)}">${escapeHtml(item.title)}</a>
      </h2>
      <p class="digest-summary">${escapeHtml(summary)}</p>
    </article>
  `;
  }).join('\n');
}

function renderShell(input: {
  siteTitle: string;
  targetDate: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.siteTitle)} - ${escapeHtml(input.targetDate)}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f5fb; color: #1f2937; }
      .page { max-width: 920px; margin: 0 auto; padding: 32px 20px 48px; }
      .header { margin-bottom: 24px; }
      .back-link { display: inline-block; margin-bottom: 14px; color: #534ab7; font-size: 14px; font-weight: 600; text-decoration: none; }
      .back-link:hover { text-decoration: underline; }
      .title { margin: 0; font-size: 32px; }
      .subtitle { margin: 8px 0 0; color: #6b7280; }
      .content { background: #ffffff; border: 1px solid #e6e4f2; border-radius: 18px; padding: 20px; box-shadow: 0 12px 36px rgba(83, 74, 183, 0.08); }
      .digest-card { padding: 20px; border-top: 1px solid #eceaf5; display: flex; flex-direction: column; gap: 10px; }
      .digest-card:first-child { border-top: 0; padding-top: 0; }
      .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .rank-pill { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; flex-shrink: 0; background: #faeeda; color: #ba7517; letter-spacing: 0.02em; }
      .topic-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .topic-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #eeedfe; color: #3c3489; }
      .digest-title { margin: 0; font-size: 20px; line-height: 1.45; }
      .digest-title a { color: #0f172a; text-decoration: none; }
      .digest-title a:hover { text-decoration: underline; }
      .digest-summary { margin: 0; font-size: 14px; line-height: 1.75; color: #4b5563; }
      .empty-state { color: #6b7280; line-height: 1.6; }
      @media (max-width: 640px) {
        .page { padding: 24px 14px 32px; }
        .content { padding: 16px; }
        .digest-card { padding: 16px 0; }
        .card-top { flex-direction: column; align-items: flex-start; }
        .topic-badges { justify-content: flex-start; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <a class="back-link" href="https://deanlu.ai/">← 返回 deanlu.ai</a>
        <h1 class="title">${escapeHtml(input.siteTitle)}</h1>
        <p class="subtitle">${escapeHtml(input.targetDate)}</p>
      </header>
      <section class="content">${input.bodyHtml}</section>
    </main>
  </body>
</html>`;
}

export function renderStaticIndexPage(input: StaticIndexPageInput): string {
  return renderShell({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    bodyHtml: renderItems(input.items),
  });
}
