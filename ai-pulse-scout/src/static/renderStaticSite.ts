import type { NormalizedItem } from '../types/item.js';
import { buildChineseDigestFallback } from '../render/buildChineseDigestFallback.js';

interface StaticPageInput {
  siteTitle: string;
  targetDate: string;
  items: NormalizedItem[];
}

interface StaticIndexPageInput extends StaticPageInput {
  recentDays: string[];
}

interface StaticDayPageInput extends StaticPageInput {
  homeHref: string;
  recentDays: string[];
}

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

type EnrichmentLikeItem = NormalizedItem & {
  why_it_matters?: string;
};

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function getPreferredSummary(item: NormalizedItem): string {
  const enrichmentCandidate = (item as EnrichmentLikeItem).why_it_matters;
  const executiveCandidate = item.executive_insight?.why_it_matters;
  const candidateFields = [enrichmentCandidate, executiveCandidate, item.key_insight, item.summary];

  const text = candidateFields.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return truncateText(buildChineseDigestFallback(item), 360);
  }

  if (hasChinese(normalized)) {
    return truncateText(normalized, 360);
  }

  return truncateText(buildChineseDigestFallback(item), 360);
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

function computeDisplayMatch(index: number, total: number, item: NormalizedItem): number {
  const explicitScore = item.relevance_scores?.overall;
  if (typeof explicitScore === 'number' && Number.isFinite(explicitScore) && explicitScore > 0) {
    return Math.max(61, Math.min(95, Math.round(explicitScore * 100)));
  }

  if (total <= 1) {
    return 92;
  }

  const ratio = 1 - index / Math.max(total - 1, 1);
  return Math.max(61, Math.min(95, Math.round(61 + ratio * 34)));
}

function getMatchTone(match: number): 'high' | 'mid' | 'low' {
  if (match >= 80) {
    return 'high';
  }
  if (match >= 60) {
    return 'mid';
  }
  return 'low';
}

function getRelevantRank(match: number): string {
  if (match >= 90) {
    return '★★★★★';
  }
  if (match >= 80) {
    return '★★★★☆';
  }
  if (match >= 70) {
    return '★★★☆☆';
  }
  return '★★☆☆☆';
}

function renderItems(items: NormalizedItem[]): string {
  if (items.length === 0) {
    return '<div class="empty-state">当前没有可展示的 digest 内容。</div>';
  }

  return items.map((item, index) => {
    const badges = inferTopicBadges(item);
    const match = computeDisplayMatch(index, items.length, item);
    const matchTone = getMatchTone(match);
    const summary = getPreferredSummary(item);
    const relevantRank = getRelevantRank(match);

    return `
    <article class="digest-card">
      <div class="card-top">
        <span class="match-pill match-${matchTone}">${match}% match</span>
        <div class="topic-badges">${badges.map((badge) => `<span class="topic-badge">${escapeHtml(badge)}</span>`).join('')}</div>
      </div>
      <h2 class="digest-title">
        <a href="${escapeHtml(item.item_url)}">${escapeHtml(item.title)}</a>
      </h2>
      <p class="digest-summary">${escapeHtml(summary)}</p>
      <div class="card-footer">
        <div class="footer-group">
          <span class="footer-label">Relevant rank</span>
          <span class="footer-value">${relevantRank}</span>
        </div>
        <div class="footer-divider"></div>
        <div class="footer-group footer-followup">
          <span class="footer-label">Follow-up</span>
          <span class="followup-pill">待跟进</span>
        </div>
      </div>
    </article>
  `;
  }).join('\n');
}

function renderRecentDaysNav(recentDays: string[], hrefPrefix: string): string {
  return `
    <nav class="nav">
      <h2>最近 7 天</h2>
      <ol class="recent-days">
        ${recentDays.map((day) => `<li><a href="${escapeHtml(`${hrefPrefix}${day}.html`)}">${escapeHtml(day)}</a></li>`).join('')}
      </ol>
    </nav>
  `;
}

function renderShell(input: {
  siteTitle: string;
  targetDate: string;
  navHtml: string;
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
      .title { margin: 0; font-size: 32px; }
      .subtitle { margin: 8px 0 0; color: #6b7280; }
      .nav, .content { background: #ffffff; border: 1px solid #e6e4f2; border-radius: 18px; padding: 20px; box-shadow: 0 12px 36px rgba(83, 74, 183, 0.08); }
      .nav { margin-bottom: 20px; }
      .nav h2 { margin: 0 0 12px; font-size: 18px; }
      .recent-days { list-style: none; margin: 0; padding-left: 0; display: flex; flex-wrap: wrap; gap: 12px; }
      .recent-days li { margin: 0; }
      .digest-card { padding: 20px; border-top: 1px solid #eceaf5; display: flex; flex-direction: column; gap: 10px; }
      .digest-card:first-child { border-top: 0; padding-top: 0; }
      .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .match-pill { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; flex-shrink: 0; }
      .match-high { background: #eaf3de; color: #3b6d11; }
      .match-mid { background: #faeeda; color: #ba7517; }
      .match-low { background: #fcebeb; color: #a32d2d; }
      .topic-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .topic-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #eeedfe; color: #3c3489; }
      .digest-title { margin: 0; font-size: 20px; line-height: 1.45; }
      .digest-title a { color: #0f172a; text-decoration: none; }
      .digest-title a:hover { text-decoration: underline; }
      .digest-summary { margin: 0; font-size: 14px; line-height: 1.75; color: #4b5563; }
      .card-footer { display: flex; align-items: center; gap: 14px; padding-top: 10px; border-top: 1px solid #eceaf5; flex-wrap: wrap; }
      .footer-group { display: flex; align-items: center; gap: 8px; }
      .footer-label { font-size: 12px; color: #6b7280; }
      .footer-value, .followup-pill { font-size: 12px; font-weight: 600; }
      .footer-value { color: #ba7517; letter-spacing: 0.04em; }
      .followup-pill { color: #534ab7; }
      .footer-divider { width: 1px; height: 16px; background: #e6e4f2; }
      .empty-state { color: #6b7280; line-height: 1.6; }
      @media (max-width: 640px) {
        .page { padding: 24px 14px 32px; }
        .nav, .content { padding: 16px; }
        .digest-card { padding: 16px 0; }
        .card-top { flex-direction: column; align-items: flex-start; }
        .topic-badges { justify-content: flex-start; }
        .card-footer { align-items: flex-start; }
        .footer-divider { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <h1 class="title">${escapeHtml(input.siteTitle)}</h1>
        <p class="subtitle">${escapeHtml(input.targetDate)}</p>
      </header>
      ${input.navHtml}
      <section class="content">${input.bodyHtml}</section>
    </main>
  </body>
</html>`;
}

export function renderStaticIndexPage(input: StaticIndexPageInput): string {
  return renderShell({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    navHtml: renderRecentDaysNav(input.recentDays, 'days/'),
    bodyHtml: renderItems(input.items),
  });
}

export function renderStaticDayPage(input: StaticDayPageInput): string {
  return renderShell({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    navHtml: renderRecentDaysNav(input.recentDays, ''),
    bodyHtml: renderItems(input.items),
  });
}
