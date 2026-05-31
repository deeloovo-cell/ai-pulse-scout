import type { NormalizedItem } from '../types/item.js';

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
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderItems(items: NormalizedItem[]): string {
  if (items.length === 0) {
    return '<div class="empty-state">当前没有可展示的 digest 内容。</div>';
  }

  return items.map((item) => `
    <article class="digest-card">
      <h2 class="digest-title">
        <a href="${escapeHtml(item.item_url)}">${escapeHtml(item.title)}</a>
      </h2>
      <p class="digest-summary">${escapeHtml(item.summary || item.content_text.slice(0, 240))}</p>
      <p class="digest-meta">
        <span>${escapeHtml(item.source_name)}</span>
        <span>${escapeHtml(item.item_url)}</span>
      </p>
    </article>
  `).join('\n');
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
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1f2937; }
      .page { max-width: 860px; margin: 0 auto; padding: 32px 20px 48px; }
      .header { margin-bottom: 24px; }
      .title { margin: 0; font-size: 32px; }
      .subtitle { margin: 8px 0 0; color: #4b5563; }
      .nav, .content { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06); }
      .nav { margin-bottom: 20px; }
      .nav h2 { margin: 0 0 12px; font-size: 18px; }
      .recent-days { margin: 0; padding-left: 20px; }
      .recent-days li { margin: 6px 0; }
      .digest-card { padding: 18px 0; border-top: 1px solid #e5e7eb; }
      .digest-card:first-child { border-top: 0; padding-top: 0; }
      .digest-title { margin: 0 0 8px; font-size: 22px; }
      .digest-title a { color: #0f172a; text-decoration: none; }
      .digest-title a:hover { text-decoration: underline; }
      .digest-summary { margin: 0 0 10px; line-height: 1.6; color: #374151; }
      .digest-meta { margin: 0; font-size: 13px; color: #6b7280; word-break: break-word; display: flex; flex-direction: column; gap: 4px; }
      .empty-state { color: #6b7280; line-height: 1.6; }
      .backlink { display: inline-block; margin-bottom: 16px; color: #2563eb; text-decoration: none; }
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
  const navHtml = `
    <nav class="nav">
      <h2>最近 7 天</h2>
      <ol class="recent-days">
        ${input.recentDays.map((day) => `<li><a href="days/${escapeHtml(day)}.html">${escapeHtml(day)}</a></li>`).join('')}
      </ol>
    </nav>
  `;

  return renderShell({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    navHtml,
    bodyHtml: renderItems(input.items),
  });
}

export function renderStaticDayPage(input: StaticDayPageInput): string {
  return renderShell({
    siteTitle: input.siteTitle,
    targetDate: input.targetDate,
    navHtml: '',
    bodyHtml: `<a class="backlink" href="${escapeHtml(input.homeHref)}">返回首页</a>${renderItems(input.items)}`,
  });
}
