import type { NormalizedItem } from '../types/item.js';
import type { ExecutiveBrief, ExecutiveInsight } from '../types/executive.js';
import { DIGEST_TOPICS } from '../topics/topicOrder.js';
import { TOPIC_LABELS_ZH } from '../topics/topicLabels.js';
import { defaultExecutiveInsight } from '../insights/parseExecutiveInsight.js';
import { buildChineseDigestFallback } from './buildChineseDigestFallback.js';
import { formatDigestDate } from '../utils/time.js';

const ITEM_COLORS = ['#f4f8fc', '#faf6f0'];
const ACCENT = '#0d5cab';
const GROWTH_LEVER_LABELS: Record<string, string> = {
  Efficiency: '效率',
  Quality: '质量',
  Revenue: '收入',
  Speed: '速度',
  Risk: '风险',
};
const APPLIES_TO_LABELS: Record<string, string> = {
  Design: '设计',
  Process: '流程',
  'Shop floor': '车间',
  'Supply chain': '供应链',
  'R&D': '研发',
};
const ACTION_LABELS: Record<string, string> = {
  Monitor: '持续跟踪',
  'Evaluate pilot': '评估试点',
  'Engage partner': '接洽合作方',
};
const RELEVANCE_LABELS: Record<string, string> = {
  High: '高',
  Medium: '中',
  Low: '低',
};

export interface DigestRenderOptions {
  items: NormalizedItem[];
  date: Date;
  subjectTemplate: string;
  executiveBrief?: ExecutiveBrief | null;
}

export function buildSubject(template: string, date: Date, itemCount?: number): string {
  const withDate = template.replace('{date}', formatDigestDate(date));
  if (itemCount == null) return withDate;
  return withDate.replace('{count}', String(itemCount));
}

export function renderHtmlEmail(options: DigestRenderOptions): string {
  const { items, date, subjectTemplate, executiveBrief } = options;
  const subject = buildSubject(subjectTemplate, date, items.length);

  const groupedItems = DIGEST_TOPICS.flatMap((topic) => {
    const topicItems = items.filter((item) => item.primary_topic === topic);
    if (topicItems.length === 0) return [];

    return [renderTopicHeading(topic), ...topicItems.map((item, index) => renderItem(item, index))];
  });

  const itemsHtml = groupedItems.join('\n');
  const briefHtml = executiveBrief ? renderExecutiveBrief(executiveBrief) : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#1a1a1a;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;">
  <tr>
    <td style="padding:24px 20px 14px 20px;border-bottom:3px solid ${ACCENT};">
      <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:bold;">AI Pulse Scout</h1>
      <p style="margin:6px 0 0 0;font-size:16px;color:#1a1a1a;line-height:1.5;font-weight:600;">今日 AI 情报</p>
      <p style="margin:6px 0 0 0;font-size:13px;color:#555;line-height:1.5;">
        ${escapeHtml(formatDigestDate(date))} &nbsp;|&nbsp; 共 ${items.length} 条 &nbsp;|&nbsp; 过去 24 小时
      </p>
    </td>
  </tr>
  ${briefHtml}
  ${items.length === 0 ? renderEmptyState() : itemsHtml}
  <tr>
    <td style="padding:20px;font-size:11px;color:#999;border-top:2px solid #e0e0e0;text-align:center;">
      AI Pulse Scout &mdash; 每日自动情报 &mdash; ${escapeHtml(formatDigestDate(date))}
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderExecutiveBrief(brief: ExecutiveBrief): string {
  return `<tr>
    <td style="padding:20px;background:#eef4fb;border-bottom:1px solid #d7e3f4;">
      <h2 style="margin:0 0 12px 0;font-size:17px;color:${ACCENT};font-weight:bold;">Executive brief</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#333;line-height:1.55;">
        ${briefRow('Productivity upside', brief.productivity_upside)}
        ${briefRow('Adoption / implementation risk', brief.adoption_implementation_risk)}
        ${briefRow('Technical signal', brief.technical_signal)}
        ${briefRow('Suggested action', brief.suggested_action)}
      </table>
    </td>
  </tr>`;
}

function briefRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:0 0 10px 0;vertical-align:top;">
      <strong style="color:#1a1a1a;">${label}:</strong> ${escapeHtml(value)}
    </td>
  </tr>`;
}

function renderEmptyState(): string {
  return `<tr>
    <td style="padding:24px 20px;font-size:14px;color:#555;">
      当前时间窗内没有新的 AI 情报，相关来源会继续参与下一次抓取。
    </td>
  </tr>`;
}

function renderTopicHeading(topic: string): string {
  return `<tr>
    <td style="padding:18px 20px 8px 20px;background:#ffffff;border-top:2px solid #d7e3f4;border-bottom:1px solid #d7e3f4;">
      <h2 style="margin:0;font-size:17px;color:#1a1a1a;font-weight:bold;">${escapeHtml(TOPIC_LABELS_ZH[topic] ?? topic)}</h2>
    </td>
  </tr>`;
}

function renderItem(item: NormalizedItem, index: number): string {
  const bgColor = ITEM_COLORS[index % ITEM_COLORS.length];
  const insight = resolveExecutiveInsight(item);
  const meta = renderMetaTags(insight);
  const relevance = insight.manufacturing_relevance
    ? `<span style="display:inline-block;margin-right:8px;padding:2px 8px;background:#e8f5e9;color:#2e7d32;font-size:11px;border-radius:3px;">制造相关性：${escapeHtml(RELEVANCE_LABELS[insight.manufacturing_relevance] ?? insight.manufacturing_relevance)}</span>`
    : '';

  const linkLabel = item.rawMetadata?.extractionLevel === 'link_only'
    ? `查看来源（${escapeHtml(item.source_name)}） &rarr;`
    : `${escapeHtml(item.source_name)} &rarr;`;

  return `<tr>
    <td style="padding:16px 20px;background:${bgColor};border-bottom:1px solid #e0e0e0;border-top:2px solid #ffffff;">
      <p style="margin:0 0 8px 0;font-size:15px;line-height:1.4;">
        <a href="${escapeHtml(item.item_url)}" style="color:#1a1a1a;text-decoration:underline;font-weight:bold;">
          ${escapeHtml(item.title)}
        </a>
      </p>
      <p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;">
        ${meta}
        ${relevance}
      </p>
      <p style="margin:0 0 6px 0;font-size:13px;color:#333;line-height:1.55;">
        <strong>关键信息：</strong> ${escapeHtml(renderWhyItMatters(item, insight))}
      </p>
      <p style="margin:10px 0 0 0;font-size:12px;">
        <a href="${escapeHtml(item.item_url)}" style="color:${ACCENT};text-decoration:none;">
          ${linkLabel}
        </a>
        &nbsp;<span style="color:#999;font-size:11px;">${formatPublished(item.published_at)}</span>
      </p>
    </td>
  </tr>`;
}

function renderMetaTags(insight: ExecutiveInsight): string {
  const tag = (label: string, value: string) =>
    `<span style="display:inline-block;margin:0 8px 6px 0;padding:2px 8px;background:#fff;border:1px solid #d0d7de;color:#444;font-size:11px;border-radius:3px;"><strong>${label}：</strong> ${escapeHtml(value)}</span>`;

  const applies = insight.applies_to.map((entry) => APPLIES_TO_LABELS[entry] ?? entry).join('、');
  return [
    tag('增长杠杆', GROWTH_LEVER_LABELS[insight.growth_lever] ?? insight.growth_lever),
    tag('适用范围', applies),
    tag('建议动作', ACTION_LABELS[insight.action] ?? insight.action),
  ].join('');
}

function renderWhyItMatters(item: NormalizedItem, insight: ExecutiveInsight): string {
  if (item.executive_insight || item.key_insight) {
    return insight.why_it_matters;
  }
  return buildChineseDigestFallback(item);
}

function resolveExecutiveInsight(item: NormalizedItem): ExecutiveInsight {
  if (item.executive_insight) return item.executive_insight;

  const fallbackText =
    item.key_insight ||
    item.summary ||
    item.content_text.slice(0, 250) ||
    'Open the source for full details.';

  return defaultExecutiveInsight(fallbackText, isPaperItem(item));
}

function isPaperItem(item: NormalizedItem): boolean {
  return item.content_type === 'research' || /arxiv\.org/i.test(item.item_url);
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
