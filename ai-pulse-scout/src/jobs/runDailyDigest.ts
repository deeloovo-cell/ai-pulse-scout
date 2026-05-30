import { loadConfig } from '../config/loadConfig.js';
import { renderHtmlEmail, buildSubject } from '../render/renderHtmlEmail.js';
import { saveSuccessfulRun } from '../state/runState.js';
import { appendToLedger } from '../state/ledger.js';
import { openPipelineDb, initializePipelineSchema } from '../state/db.js';
import { saveDigestReviewItems } from '../state/reviewRepository.js';
import { computeDailyCutoffWindow } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import type { MailClient } from '../mail/MailClient.js';
import type { NormalizedItem } from '../types/item.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';
import { runPipeline } from './runPipeline.js';
import { enrichSingleItem } from '../insights/analyzeKeyInsights.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../data/output');

export interface DigestRunResult {
  subject: string;
  html: string;
  items: NormalizedItem[];
  itemCount: number;
  totalFetched: number;
  outputPath: string;
}

export async function runDailyDigest(
  mailClient: MailClient | null = null,
  sendEmail = false,
): Promise<DigestRunResult> {
  const config = loadConfig();
  const now = new Date();
  const { windowStart, windowEnd } = computeDailyCutoffWindow(now);

  logger.info(`Collection window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const pipelineDbPath = process.env.PIPELINE_DB_PATH ?? (process.env.VITEST ? join(tmpdir(), `ai-pulse-scout-${now.getTime()}.sqlite`) : undefined);

  const pipelineResult = await runPipeline({
    now,
    dbPath: pipelineDbPath,
    ingest: async () => {
      const ingestion = await ingestAllSources({
        sources: config.sources,
        windowStart,
        windowEnd,
        adapters: [
          new FeedAdapter(),
          new GenericWebAdapter(),
          new YouTubeAdapter(),
          new GitHubAdapter(),
          new DocsAdapter(),
          new CommunityAdapter(),
          new PapersAdapter(),
        ],
      });

      logger.info(`Unified ingestion fetched ${ingestion.items.length} items across ${ingestion.summary.totalSources} sources`);
      logger.info(`Support summary: ${JSON.stringify(ingestion.summary.byStatus)}`);
      for (const result of ingestion.results) {
        logger.info(
          `Source ${result.source.name}: raw=${result.diagnostics.attempted} aiAccepted=${result.diagnostics.aiAccepted ?? 0} aiRejected=${result.diagnostics.aiRejected ?? 0} capped=${result.diagnostics.capped ?? result.items.length}`,
        );
      }

      return {
        items: ingestion.items.map((item) => ({
          id: item.id,
          sourceId: item.source_url,
          url: item.item_url,
          title: item.title,
          publishedAt: item.published_at ? item.published_at.toISOString() : null,
          dedupeKey: item.fingerprint,
          normalizedItem: item,
        })),
      };
    },
    fetchItem: async (item) => ({
      rawContent: item.title,
      cleanContent: item.title,
      fetchMethod: 'normalized-item-snapshot',
    }),
    enrichItem: async (item) => {
      const source = (item as { normalized_item_json?: string | null }).normalized_item_json
        ? JSON.parse((item as { normalized_item_json: string }).normalized_item_json)
        : null;
      const enriched = source ? await enrichSingleItem(source, { fetchFullPosts: false }) : null;
      return {
        summary: enriched?.summary ?? '',
        whyItMatters: enriched?.executive_insight?.why_it_matters ?? enriched?.key_insight ?? '',
        topics: enriched ? [enriched.primary_topic] : [],
        relevanceScore: enriched?.relevance_scores?.overall ?? 0,
        relevanceBucket: (enriched?.executive_insight?.manufacturing_relevance ?? 'Low').toLowerCase(),
        rawResponse: JSON.stringify(enriched?.executive_insight ?? {}),
        model: 'single-item-enrichment',
        durationMs: 0,
      };
    },
    render: (items) => {
      const typedItems = items as NormalizedItem[];
      const subject = buildSubject(config.email.subject_template, now, typedItems.length);
      return renderHtmlEmail({
        items: typedItems,
        date: now,
        subjectTemplate: config.email.subject_template,
        executiveBrief: null,
      }).replace('<title>','<title>').replace(subject, subject);
    },
    publish: async (html) => {
      if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
      const datePart = now.toISOString().slice(0, 10);
      const outputPath = join(OUTPUT_DIR, `digest-${datePart}.html`);
      writeFileSync(outputPath, html, 'utf8');

      if (sendEmail && mailClient && pipelineResultCache.items.length > 0) {
        const fromAddr = config.email.from_address || process.env.SMTP_USER || 'pulse@example.com';
        await mailClient.send({
          to: config.email.to,
          from: `${config.email.from_name} <${fromAddr}>`,
          subject: pipelineResultCache.subject,
          html,
        });
        appendToLedger(pipelineResultCache.items);
        saveSuccessfulRun(now);
        logger.info('Ledger updated and run state saved.');
      } else if (sendEmail && pipelineResultCache.items.length === 0) {
        logger.info('No digest items selected — skipping email send and state update.');
      }
    },
  });

  const typedItems = ((pipelineResult.items ?? []) as NormalizedItem[]);
  const subject = pipelineResult.subject ?? buildSubject(config.email.subject_template, now, typedItems.length);
  const html = pipelineResult.html ?? renderHtmlEmail({
    items: typedItems,
    date: now,
    subjectTemplate: config.email.subject_template,
    executiveBrief: null,
  });
  const datePart = now.toISOString().slice(0, 10);
  const outputPath = pipelineResult.outputPath ?? join(OUTPUT_DIR, `digest-${datePart}.html`);

  if (pipelineDbPath) {
    const reviewDb = openPipelineDb(pipelineDbPath);
    initializePipelineSchema(reviewDb);
    saveDigestReviewItems(reviewDb, {
      digestDate: datePart,
      runId: `run-${now.toISOString()}`,
      items: typedItems.map((item) => ({
        itemKey: item.id,
        publishedAt: item.published_at ? item.published_at.toISOString() : null,
        title: item.title,
        excerpt: item.summary || item.content_text.slice(0, 240),
        itemUrl: item.item_url,
        sourceName: item.source_name,
        topicTags: item.tags.length > 0 ? item.tags : [item.primary_topic],
        matchScore: item.relevance_scores?.overall ?? 0,
        normalizedItemJson: JSON.stringify(item),
      })),
    });
    reviewDb.close();
  }

  pipelineResultCache.subject = subject;
  pipelineResultCache.items = typedItems;

  return {
    subject,
    html,
    items: typedItems,
    itemCount: typedItems.length,
    totalFetched: pipelineResult.totalItems ?? typedItems.length,
    outputPath,
  };
}

const pipelineResultCache: { subject: string; items: NormalizedItem[] } = {
  subject: '',
  items: [],
};
