import type { NormalizedItem } from '../types/item.js';
import { DIGEST_TOPICS } from '../topics/topicOrder.js';
import { formatDigestDate } from '../utils/time.js';

// Alternating item background colors (Gmail-safe, readable)
const ITEM_COLORS = ['#f0f7ff', '#fff8f0'];

export interface DigestRenderOptions {
  items: NormalizedItem[];
  date: Date;
  subjectTemplate: string;
}

export function buildSubject(template: string, date: Date): string {
  return template.replace('{date}', formatDigestDate(date));
}

export function renderHtmlEmail(options: DigestRenderOptions): string {
  const { items, date, subjectTemplate } = options;
  const subject = buildSubject(subjectTemplate, date);

  const groupedItems = DIGEST_TOPICS.flatMap((topic) => {
    const topicItems = items.filter((item) => item.primary_topic === topic);
    if (topicItems.length === 0) return [];

    return [renderTopicHeading(topic), ...topicItems.map((item, index) => renderItem(item, index))];
  });

  const itemsHtml = groupedItems.join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;">
  <tr>
    <td style="padding:24px 20px 12px 20px;border-bottom:3px solid #1a73e8;">
      <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:bold;">AI Pulse Scout</h1>
      <p style="margin:4px 0 0 0;font-size:13px;color:#666;">${escapeHtml(formatDigestDate(date))} &nbsp;|&nbsp; ${items.length} items</p>
    </td>
  </tr>
  ${itemsHtml}
  <tr>
    <td style="padding:20px;font-size:11px;color:#999;border-top:1px solid #e0e0e0;text-align:center;">
      AI Pulse Scout &mdash; automated digest &mdash; ${escapeHtml(formatDigestDate(date))}
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderTopicHeading(topic: string): string {
  return `<tr>
    <td style="padding:18px 20px 10px 20px;background:#ffffff;border-bottom:1px solid #d7e3f4;">
      <h2 style="margin:0;font-size:18px;color:#1a1a1a;font-weight:bold;">${escapeHtml(topic)}</h2>
    </td>
  </tr>`;
}

function renderItem(item: NormalizedItem, index: number): string {
  const bgColor = ITEM_COLORS[index % ITEM_COLORS.length];
  const summary = getReadableSummary(item);
  const linkLabel = item.rawMetadata?.extractionLevel === 'link_only'
    ? `Read source (${escapeHtml(item.source_name)}) &rarr;`
    : `${escapeHtml(item.source_name)} &rarr;`;

  return `<tr>
    <td style="padding:16px 20px;background:${bgColor};border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 6px 0;font-size:15px;">
        <strong><u>${escapeHtml(item.title)}</u></strong>
      </p>
      <p style="margin:0 0 6px 0;font-size:13px;color:#333;line-height:1.5;">
        <strong>Key insight:</strong> ${escapeHtml(summary)}
      </p>
      <p style="margin:10px 0 0 0;font-size:12px;">
        <a href="${escapeHtml(item.item_url)}" style="color:#1a73e8;text-decoration:none;">
          ${linkLabel}
        </a>
        &nbsp;<span style="color:#999;font-size:11px;">${formatPublished(item.published_at)}</span>
      </p>
    </td>
  </tr>`;
}

function getReadableSummary(item: NormalizedItem): string {
  const summary = item.key_insight || item.summary || item.content_text.slice(0, 250);
  if (summary) return summary;

  if (item.rawMetadata?.extractionLevel === 'link_only') {
    return 'Direct article extraction was incomplete, but the source link still looks relevant and is included for review.';
  }

  return 'Open the source for the full item.';
}

function formatPublished(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
