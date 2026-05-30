import type { ReviewFeedItem } from './reviewTypes.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderReviewPage(input: { items: ReviewFeedItem[] }): string {
  const sortedItems = [...input.items].sort((a, b) => {
    const publishedCompare = (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '');
    if (publishedCompare !== 0) return publishedCompare;
    return a.itemKey.localeCompare(b.itemKey);
  });

  const cards = sortedItems.length === 0
    ? '<div class="empty-state">No digest items available in the last 5 days.</div>'
    : sortedItems.map((item) => {
      const topicBadges = item.topicTags.map((tag) => `<span class="topic-badge">${escapeHtml(tag)}</span>`).join('');
      const stars = [1, 2, 3, 4, 5]
        .map((value) => `<button type="button" class="star${value <= (item.rating ?? 0) ? ' filled' : ''}" data-value="${value}">★</button>`)
        .join('');

      return `
        <article class="feed-item" data-item-key="${escapeHtml(item.itemKey)}">
          <div class="item-meta">
            ${topicBadges}
            <span class="rel-pill">${Math.round(item.matchScore * 100)}% match</span>
          </div>
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
          <p class="item-excerpt">${escapeHtml(item.excerpt)}</p>
          <div class="item-footer">
            <div class="rating" data-rating="${item.rating ?? ''}">${stars}</div>
            <label class="followup-label">
              <input type="checkbox" ${item.followUp ? 'checked' : ''} />
              Follow-up
            </label>
          </div>
        </article>
      `;
    }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Pulse Scout Review</title>
  </head>
  <body>
    <div class="app">
      <div class="topbar"><div class="logo">AI Pulse Scout</div></div>
      <div class="feed">${cards}</div>
    </div>
  </body>
</html>`;
}
