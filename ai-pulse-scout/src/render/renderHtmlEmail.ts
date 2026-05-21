import type { NormalizedItem } from '../types/item.js';
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

  const itemsHtml = items
    .map((item, index) => renderItem(item, index))
    .join('\n');

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

function renderItem(item: NormalizedItem, index: number): string {
  const bgColor = ITEM_COLORS[index % ITEM_COLORS.length];
  const summary = item.summary || item.content_text.slice(0, 250);
  const aacSection = item.relevance_scores.aac_relevance > 0.2
    ? `<p style="margin:8px 0 0 0;font-size:13px;color:#555;">
        <strong>Why it matters for AAC:</strong>
        ${escapeHtml(inferAacNote(item))}
      </p>`
    : '';

  return `<tr>
    <td style="padding:16px 20px;background:${bgColor};border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 6px 0;font-size:15px;">
        <strong><u>${escapeHtml(item.title)}</u></strong>
      </p>
      <p style="margin:0 0 6px 0;font-size:13px;color:#333;line-height:1.5;">
        <strong>Key insight:</strong> ${escapeHtml(summary)}
      </p>
      <p style="margin:8px 0 0 0;font-size:13px;color:#444;">
        <strong>CIO / AI Lead:</strong> ${escapeHtml(inferCioNote(item))}
      </p>
      ${aacSection}
      <p style="margin:10px 0 0 0;font-size:12px;">
        <a href="${escapeHtml(item.item_url)}" style="color:#1a73e8;text-decoration:none;">
          ${escapeHtml(item.source_name)} &rarr;
        </a>
        &nbsp;<span style="color:#999;font-size:11px;">${formatPublished(item.published_at)}</span>
      </p>
    </td>
  </tr>`;
}

function inferCioNote(item: NormalizedItem): string {
  const scores = item.relevance_scores;
  if (scores.aac_relevance > 0.3) return 'Directly relevant to enterprise AI strategy and tooling decisions.';
  if (scores.industrial_ai > 0.3) return 'Monitor for operational AI implications in industrial deployments.';
  if (scores.ai_engineering > 0.5) return 'Key development in AI engineering — assess platform and architecture impact.';
  if (scores.executive_signal > 0.4) return 'Watch for governance, compliance, or vendor strategy implications.';
  return 'Stay informed on this development for AI leadership awareness.';
}

function inferAacNote(item: NormalizedItem): string {
  const scores = item.relevance_scores;
  if (scores.cad_cae_cam > 0.2) return 'Potential application in CAD/CAE/CAM workflows — evaluate fit for engineering tooling.';
  if (scores.industrial_ai > 0.3) return 'Relevant to industrial AI deployment patterns applicable at AAC.';
  return 'Connected to enterprise AI infrastructure decisions relevant to AAC Technologies.';
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
