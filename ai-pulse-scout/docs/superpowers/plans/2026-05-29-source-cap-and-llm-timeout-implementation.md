# Source Cap and LLM Timeout Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce AI-only item eligibility per source, cap each source to its top 10 compliant items before merge/dedupe, and make LLM-backed insight/brief generation timeout safely instead of hanging the digest.

**Architecture:** Add a lightweight source-local filtering/ranking stage between adapter ingestion and global merge, implemented as small focused utilities so daily and backfill runs can share the same behavior. Harden the shared chat-completion client with abortable timeouts and preserve the existing fallback paths in insight/brief generation so scheduled sends degrade instead of stalling.

**Tech Stack:** TypeScript, Vitest, Node.js fetch/AbortController, existing AI Pulse Scout ingestion pipeline

---

## File Structure

### New files
- `src/filtering/isAiRelevant.ts` — lightweight deterministic AI relevance gate based on title/summary/content/source metadata
- `src/filtering/rankSourceItems.ts` — source-local ordering utilities matching the current recency/extraction/timestamp behavior
- `src/filtering/capSourceItems.ts` — source-local pipeline that filters non-AI items, ranks survivors, truncates to top N, and returns counts for logs
- `tests/isAiRelevant.test.ts` — unit tests for AI relevance inclusion/exclusion behavior
- `tests/capSourceItems.test.ts` — unit tests for source-local filtering/ranking/capping behavior
- `tests/chatCompletions.test.ts` — timeout/abort tests for shared LLM request client

### Modified files
- `src/ingest/types.ts` — extend ingestion summary/result types to report source-level counts after AI filtering and capping
- `src/ingest/ingestAllSources.ts` — apply source-local AI filter + ranking + top-10 cap before merge and log/return counts
- `src/insights/chatCompletions.ts` — add request timeout + abort handling
- `src/jobs/runDailyDigest.ts` — consume richer ingestion summary and log capped totals
- `src/jobs/runBackfill.ts` — switch to the same capped ingestion pipeline used by daily runs
- `tests/selectItems.test.ts` — keep selection tests aligned with the post-dedupe stage only if any helper extraction is needed

### Existing files to read before implementation
- `src/ingest/ingestAllSources.ts`
- `src/ingest/types.ts`
- `src/insights/analyzeKeyInsights.ts`
- `src/insights/generateExecutiveBrief.ts`
- `src/insights/chatCompletions.ts`
- `src/jobs/runDailyDigest.ts`
- `src/jobs/runBackfill.ts`
- `src/filtering/selectItems.ts`

---

### Task 1: Add a deterministic AI relevance gate

**Files:**
- Create: `src/filtering/isAiRelevant.ts`
- Test: `tests/isAiRelevant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { isAiRelevant } from '../src/filtering/isAiRelevant.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'item-1',
    source_name: 'Test Source',
    source_category: 'research',
    source_url: 'https://example.com/feed',
    item_url: 'https://example.com/post',
    title: 'Test title',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'Test content',
    summary: 'Test summary',
    tags: [],
    content_type: 'article',
    fingerprint: 'fp-1',
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

describe('isAiRelevant', () => {
  it('accepts clearly AI-related model/system items', () => {
    const item = makeItem({
      title: 'Open-source agent framework for LLM workflow orchestration',
      summary: 'Covers agent runtime design, model routing, tool use, and inference orchestration.',
    });

    expect(isAiRelevant(item)).toBe(true);
  });

  it('accepts clearly AI-related research items', () => {
    const item = makeItem({
      content_type: 'research',
      title: 'Diffusion policy for robotic manipulation',
      summary: 'A machine learning approach for robot control trained on multimodal data.',
    });

    expect(isAiRelevant(item)).toBe(true);
  });

  it('rejects generic software items with no AI angle', () => {
    const item = makeItem({
      title: 'How we improved CI pipeline stability',
      summary: 'A post about flaky tests, build caching, and release automation.',
    });

    expect(isAiRelevant(item)).toBe(false);
  });

  it('rejects broad policy/social items without specific AI linkage', () => {
    const item = makeItem({
      title: 'Computers and society in modern workplaces',
      summary: 'General discussion of technology and workplace change with no AI-specific details.',
    });

    expect(isAiRelevant(item)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/isAiRelevant.test.ts`
Expected: FAIL with `Cannot find module '../src/filtering/isAiRelevant.js'` or missing export error.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { NormalizedItem } from '../types/item.js';

const POSITIVE_PATTERNS = [
  /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|large language model|foundation model|generative ai)\b/i,
  /\b(agent|multi-agent|model routing|prompt|inference|fine-tuning|rag|embedding|vector|multimodal)\b/i,
  /\b(computer vision|vision-language|nlp|natural language|speech model|robot learning|diffusion policy|autonomous robot)\b/i,
  /\b(monitoring ai|ai deployment|model serving|mlops|ai tooling|ai copilot|ai chip|accelerator)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(ci\/cd|continuous integration|release automation|frontend build|css|design system)\b/i,
  /\b(workplace technology|digital transformation|technology in society)\b/i,
];

function buildHaystack(item: NormalizedItem): string {
  return [
    item.source_name,
    item.source_category,
    item.title,
    item.summary,
    item.content_text,
    item.tags.join(' '),
    item.primary_topic,
  ]
    .filter(Boolean)
    .join('\n');
}

export function isAiRelevant(item: NormalizedItem): boolean {
  const haystack = buildHaystack(item);

  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(haystack)) && !POSITIVE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  return POSITIVE_PATTERNS.some((pattern) => pattern.test(haystack));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/isAiRelevant.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filtering/isAiRelevant.ts tests/isAiRelevant.test.ts
git commit -m "feat: add deterministic ai relevance gate"
```

---

### Task 2: Add source-local ranking and capping

**Files:**
- Create: `src/filtering/rankSourceItems.ts`
- Create: `src/filtering/capSourceItems.ts`
- Test: `tests/capSourceItems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { capSourceItems } from '../src/filtering/capSourceItems.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'item',
    source_name: 'arXiv cs.AI',
    source_category: 'research',
    source_url: 'https://arxiv.org/rss/cs.AI',
    item_url: 'https://example.com/item',
    title: 'AI item',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'AI model systems content',
    summary: 'AI summary',
    tags: [],
    content_type: 'research',
    fingerprint: 'fp',
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

describe('capSourceItems', () => {
  it('drops non-ai items before ranking and truncation', () => {
    const result = capSourceItems([
      makeItem({ id: 'ai-1', title: 'LLM inference serving for agents' }),
      makeItem({ id: 'non-ai', title: 'Build cache tuning for CI pipelines', summary: 'No AI content here', content_type: 'article' }),
    ], 10);

    expect(result.items.map((item) => item.id)).toEqual(['ai-1']);
    expect(result.counts.aiRejected).toBe(1);
  });

  it('keeps only the top 10 per source after ranking', () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      makeItem({
        id: `item-${index + 1}`,
        title: `LLM systems item ${index + 1}`,
        published_at: new Date(`2026-05-29T${String(index).padStart(2, '0')}:00:00Z`),
      }),
    );

    const result = capSourceItems(items, 10);

    expect(result.items).toHaveLength(10);
    expect(result.counts.raw).toBe(12);
    expect(result.counts.aiAccepted).toBe(12);
    expect(result.counts.capped).toBe(10);
    expect(result.items[0]?.id).toBe('item-12');
    expect(result.items.at(-1)?.id).toBe('item-3');
  });

  it('uses extraction level and timestamp confidence as tie-breakers', () => {
    const result = capSourceItems([
      makeItem({ id: 'link-only', title: 'AI ranking item A', published_at: new Date('2026-05-29T10:00:00Z'), rawMetadata: { extractionLevel: 'link_only', publishedAtConfidence: 'derived' } }),
      makeItem({ id: 'partial', title: 'AI ranking item B', published_at: new Date('2026-05-29T10:00:00Z'), rawMetadata: { extractionLevel: 'article_partial', publishedAtConfidence: 'derived' } }),
      makeItem({ id: 'full', title: 'AI ranking item C', published_at: new Date('2026-05-29T10:00:00Z'), rawMetadata: { extractionLevel: 'article_full', publishedAtConfidence: 'exact' } }),
    ], 10);

    expect(result.items.map((item) => item.id)).toEqual(['full', 'partial', 'link-only']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: FAIL with missing module error for `capSourceItems`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/filtering/rankSourceItems.ts
import type { NormalizedItem } from '../types/item.js';

export function rankSourceItems(items: NormalizedItem[]): NormalizedItem[] {
  return [...items].sort((a, b) => {
    const timeDiff = getSortTime(b) - getSortTime(a);
    if (timeDiff !== 0) return timeDiff;

    const extractionDiff = extractionWeight(b) - extractionWeight(a);
    if (extractionDiff !== 0) return extractionDiff;

    return timestampWeight(b) - timestampWeight(a);
  });
}

function getSortTime(item: NormalizedItem): number {
  return item.published_at?.getTime() ?? item.fetched_at.getTime();
}

function extractionWeight(item: NormalizedItem): number {
  const level = item.rawMetadata?.extractionLevel;
  if (level === 'article_full') return 3;
  if (level === 'article_partial') return 2;
  if (level === 'link_only') return 1;
  return 2;
}

function timestampWeight(item: NormalizedItem): number {
  const confidence = item.rawMetadata?.publishedAtConfidence ?? (item.published_at ? 'exact' : 'fallback_discovered_at');
  if (confidence === 'exact') return 2;
  if (confidence === 'derived') return 1;
  return 0;
}
```

```ts
// src/filtering/capSourceItems.ts
import type { NormalizedItem } from '../types/item.js';
import { isAiRelevant } from './isAiRelevant.js';
import { rankSourceItems } from './rankSourceItems.js';

export interface SourceCapCounts {
  raw: number;
  aiAccepted: number;
  aiRejected: number;
  capped: number;
}

export interface SourceCapResult {
  items: NormalizedItem[];
  counts: SourceCapCounts;
}

export function capSourceItems(items: NormalizedItem[], limit = 10): SourceCapResult {
  const aiAccepted = items.filter((item) => isAiRelevant(item));
  const ranked = rankSourceItems(aiAccepted);
  const capped = ranked.slice(0, limit);

  return {
    items: capped,
    counts: {
      raw: items.length,
      aiAccepted: aiAccepted.length,
      aiRejected: items.length - aiAccepted.length,
      capped: capped.length,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filtering/rankSourceItems.ts src/filtering/capSourceItems.ts tests/capSourceItems.test.ts
git commit -m "feat: cap each source after ai relevance filtering"
```

---

### Task 3: Apply capped source processing inside shared ingestion

**Files:**
- Modify: `src/ingest/types.ts`
- Modify: `src/ingest/ingestAllSources.ts`
- Test: `tests/capSourceItems.test.ts`

- [ ] **Step 1: Write the failing test**

Append this block to `tests/capSourceItems.test.ts`:

```ts
import { ingestAllSources } from '../src/ingest/ingestAllSources.js';
import type { ProductionSourceAdapter } from '../src/adapters/types.js';
import type { SourceConfig } from '../src/types/config.js';

function makeSource(name: string, url: string): SourceConfig {
  return {
    name,
    category: 'research',
    url,
    type: 'rss',
    enabled: true,
  };
}

describe('ingestAllSources', () => {
  it('caps each source before merge and reports source-level counts', async () => {
    const sourceA = makeSource('Source A', 'https://example.com/a.xml');
    const sourceB = makeSource('Source B', 'https://example.com/b.xml');

    const adapter: ProductionSourceAdapter = {
      canHandle: () => true,
      ingest: async ({ source }) => ({
        source,
        status: 'production_supported',
        diagnostics: { attempted: 12, normalized: 12, dropped: 0, adapterType: 'feed' },
        items: Array.from({ length: 12 }, (_, index) =>
          makeItem({
            id: `${source.name}-${index + 1}`,
            source_name: source.name,
            source_url: source.url,
            title: `LLM systems ${source.name} ${index + 1}`,
            published_at: new Date(`2026-05-29T${String(index).padStart(2, '0')}:00:00Z`),
          }),
        ),
      }),
    };

    const result = await ingestAllSources({
      sources: [sourceA, sourceB],
      windowStart: new Date('2026-05-29T00:00:00Z'),
      windowEnd: new Date('2026-05-30T00:00:00Z'),
      adapters: [adapter],
    });

    expect(result.items).toHaveLength(20);
    expect(result.summary.totalItems).toBe(20);
    expect(result.results[0]?.diagnostics.aiAccepted).toBe(12);
    expect(result.results[0]?.diagnostics.capped).toBe(10);
    expect(result.results[1]?.diagnostics.capped).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: FAIL because `aiAccepted` / `capped` are not present in diagnostics or merge still returns all items.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ingest/types.ts
export interface IngestionDiagnostics {
  attempted: number;
  normalized: number;
  dropped: number;
  aiAccepted?: number;
  aiRejected?: number;
  capped?: number;
  reason?: string;
  adapterType?: string;
}
```

```ts
// src/ingest/ingestAllSources.ts
import { capSourceItems } from '../filtering/capSourceItems.js';

// inside the for-loop, replace the direct push(await adapter.ingest(...)) path with:
const ingested = await adapter.ingest({
  source,
  windowStart: input.windowStart,
  windowEnd: input.windowEnd,
});

const capped = capSourceItems(ingested.items, 10);

results.push({
  ...ingested,
  items: capped.items,
  diagnostics: {
    ...ingested.diagnostics,
    aiAccepted: capped.counts.aiAccepted,
    aiRejected: capped.counts.aiRejected,
    capped: capped.counts.capped,
    dropped: ingested.diagnostics.dropped + capped.counts.aiRejected + (capped.counts.aiAccepted - capped.counts.capped),
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/types.ts src/ingest/ingestAllSources.ts tests/capSourceItems.test.ts
git commit -m "feat: apply per-source ai filtering and capping in ingestion"
```

---

### Task 4: Reuse capped ingestion in backfill and improve runtime logs

**Files:**
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `src/jobs/runBackfill.ts`
- Test: `tests/capSourceItems.test.ts`

- [ ] **Step 1: Write the failing test**

Append this block to `tests/capSourceItems.test.ts`:

```ts
import { vi } from 'vitest';

vi.mock('../src/config/loadConfig.js', () => ({
  loadConfig: () => ({
    sources: [makeSource('Source A', 'https://example.com/a.xml')],
    digest: { max_items: 20, collection_window_hours: 24, safety_buffer_hours: 0 },
    email: { to: 'test@example.com', from_name: 'AI Pulse Scout', from_address: 'test@example.com', subject_template: 'AI Pulse Scout -- MM-DD-YYYY', reply_to: 'test@example.com' },
  }),
}));

vi.mock('../src/ingest/ingestAllSources.js', () => ({
  ingestAllSources: vi.fn().mockResolvedValue({
    items: [makeItem({ id: 'kept', title: 'LLM kept item' })],
    results: [
      {
        source: makeSource('Source A', 'https://example.com/a.xml'),
        status: 'production_supported',
        items: [makeItem({ id: 'kept', title: 'LLM kept item' })],
        diagnostics: { attempted: 25, normalized: 25, dropped: 15, aiAccepted: 12, aiRejected: 13, capped: 10, adapterType: 'feed' },
      },
    ],
    summary: {
      totalSources: 1,
      totalItems: 1,
      byStatus: { production_supported: 1, partial_supported: 0, discoverable_only: 0, deferred: 0, broken: 0 },
    },
  }),
}));

vi.mock('../src/insights/analyzeKeyInsights.js', () => ({
  enrichKeyInsights: vi.fn().mockImplementation(async (items) => items),
}));

vi.mock('../src/insights/generateExecutiveBrief.js', () => ({
  generateExecutiveBrief: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/render/renderHtmlEmail.js', () => ({
  buildSubject: () => 'AI Pulse Scout -- 05-29-2026',
  renderHtmlEmail: () => '<html></html>',
}));

vi.mock('../src/state/ledger.js', () => ({
  loadLedger: () => new Set<string>(),
  appendToLedger: vi.fn(),
}));

vi.mock('../src/state/runState.js', () => ({
  saveSuccessfulRun: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runBackfill } from '../src/jobs/runBackfill.js';

describe('runBackfill', () => {
  it('uses shared capped ingestion instead of uncapped fetchAllSources', async () => {
    const result = await runBackfill(null, { days: 7, send: false });
    expect(result.itemCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: FAIL because `runBackfill()` still imports/uses `fetchAllSources` rather than `ingestAllSources`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/jobs/runBackfill.ts
import { ingestAllSources } from '../ingest/ingestAllSources.js';
import { FeedAdapter } from '../adapters/feedAdapter.js';
import { GenericWebAdapter } from '../adapters/genericWebAdapter.js';
import { YouTubeAdapter } from '../adapters/youtubeAdapter.js';
import { GitHubAdapter } from '../adapters/githubAdapter.js';
import { DocsAdapter } from '../adapters/docsAdapter.js';
import { CommunityAdapter } from '../adapters/communityAdapter.js';
import { PapersAdapter } from '../adapters/papersAdapter.js';

// remove fetchAllSources import and replace fetchResults/allItems block with:
const ingestion = await ingestAllSources({
  sources: config.sources,
  windowStart,
  windowEnd: now,
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
const allItems = ingestion.items;
logger.info(`Unified ingestion fetched ${allItems.length} items across ${ingestion.summary.totalSources} sources`);
for (const result of ingestion.results) {
  logger.info(
    `Source ${result.source.name}: raw=${result.diagnostics.attempted} aiAccepted=${result.diagnostics.aiAccepted ?? 0} aiRejected=${result.diagnostics.aiRejected ?? 0} capped=${result.diagnostics.capped ?? result.items.length}`,
  );
}
```

```ts
// src/jobs/runDailyDigest.ts
logger.info(`Unified ingestion fetched ${allItems.length} items across ${ingestion.summary.totalSources} sources`);
logger.info(`Support summary: ${JSON.stringify(ingestion.summary.byStatus)}`);
for (const result of ingestion.results) {
  logger.info(
    `Source ${result.source.name}: raw=${result.diagnostics.attempted} aiAccepted=${result.diagnostics.aiAccepted ?? 0} aiRejected=${result.diagnostics.aiRejected ?? 0} capped=${result.diagnostics.capped ?? result.items.length}`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/capSourceItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/jobs/runDailyDigest.ts src/jobs/runBackfill.ts tests/capSourceItems.test.ts
git commit -m "refactor: share capped ingestion across digest runs"
```

---

### Task 5: Add abortable timeout protection to chat completions

**Files:**
- Modify: `src/insights/chatCompletions.ts`
- Test: `tests/chatCompletions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestChatCompletion } from '../src/insights/chatCompletions.js';

const client = {
  apiKey: 'test-key',
  model: 'deepseek-v3.2',
  endpoint: 'https://example.com/chat/completions',
};

describe('requestChatCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('aborts and throws a timeout error when fetch stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
        });
      }),
    );

    const pending = requestChatCompletion(client, [{ role: 'user', content: 'hello' }], 10, 50);
    await vi.advanceTimersByTimeAsync(60);

    await expect(pending).rejects.toThrow('timed out');
  });

  it('returns message content when fetch succeeds before timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      }),
    );

    await expect(
      requestChatCompletion(client, [{ role: 'user', content: 'hello' }], 10, 1000),
    ).resolves.toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chatCompletions.test.ts`
Expected: FAIL because `requestChatCompletion()` does not accept a timeout argument and does not abort fetch.

- [ ] **Step 3: Write minimal implementation**

```ts
const DEFAULT_CHAT_TIMEOUT_MS = 20000;

export async function requestChatCompletion(
  client: LlmClientConfig,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens = 800,
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(client.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: client.model,
        messages,
        thinking: { type: 'disabled' },
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as ChatCompletionsResult;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `LLM request failed with HTTP ${response.status}`);
    }

    return payload.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted) {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chatCompletions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/insights/chatCompletions.ts tests/chatCompletions.test.ts
git commit -m "fix: timeout stalled llm requests"
```

---

### Task 6: Verify fallback behavior still completes the digest

**Files:**
- Modify: `tests/chatCompletions.test.ts`
- Test: `tests/chatCompletions.test.ts`

- [ ] **Step 1: Write the failing test**

Append this block to `tests/chatCompletions.test.ts`:

```ts
import { generateExecutiveBrief } from '../src/insights/generateExecutiveBrief.js';
import { enrichKeyInsights } from '../src/insights/analyzeKeyInsights.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeInsightItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: 'i1',
    source_name: 'Source',
    source_category: 'research',
    source_url: 'https://example.com/feed',
    item_url: 'https://example.com/item',
    title: 'AI item',
    published_at: new Date('2026-05-29T00:00:00Z'),
    fetched_at: new Date('2026-05-29T00:01:00Z'),
    author: '',
    content_text: 'This is about llm inference and multimodal models.',
    summary: 'This is about llm inference and multimodal models.',
    tags: [],
    content_type: 'research',
    fingerprint: 'fp-i1',
    relevance_scores: {
      ai_engineering: 0,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall: 0,
    },
    decision: 'pending',
    decision_reason: '',
    primary_topic: 'AI News Roundup',
    rawMetadata: {},
    ...overrides,
  };
}

describe('LLM fallback behavior', () => {
  it('returns fallback executive brief when chat completion times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    }));
    vi.useFakeTimers();

    const pending = generateExecutiveBrief([makeInsightItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://example.com',
      model: 'deepseek-v3.2',
    });

    await vi.advanceTimersByTimeAsync(21000);
    const brief = await pending;

    expect(brief).not.toBeNull();
    expect(brief?.suggested_action).toContain('Assign a short technical review');
  });

  it('returns fallback key insights when chat completion times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    }));
    vi.useFakeTimers();

    const pending = enrichKeyInsights([makeInsightItem()], {
      apiKey: 'test-key',
      baseUrl: 'https://example.com',
      model: 'deepseek-v3.2',
      fetchFullPosts: false,
    });

    await vi.advanceTimersByTimeAsync(21000);
    const items = await pending;

    expect(items[0]?.key_insight).toBeTruthy();
    expect(items[0]?.executive_insight).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chatCompletions.test.ts`
Expected: FAIL if timeout aborts are not converted into the existing fallback path cleanly.

- [ ] **Step 3: Write minimal implementation**

No new production code should be necessary if Task 5 is correct. If a failure reveals message-shape mismatch, keep the production change minimal, for example:

```ts
// src/insights/analyzeKeyInsights.ts or src/insights/generateExecutiveBrief.ts
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(`Executive brief generation failed: ${message}`);
  return buildFallbackBrief(items);
}
```

Use the same minimal pattern already present; do not redesign fallback behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chatCompletions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/chatCompletions.test.ts src/insights/analyzeKeyInsights.ts src/insights/generateExecutiveBrief.ts
git commit -m "test: verify llm timeout fallback behavior"
```

---

### Task 7: Full verification

**Files:**
- Modify: none
- Test: `tests/isAiRelevant.test.ts`
- Test: `tests/capSourceItems.test.ts`
- Test: `tests/chatCompletions.test.ts`
- Test: full suite

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/isAiRelevant.test.ts tests/capSourceItems.test.ts tests/chatCompletions.test.ts`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS with all existing and new tests green.

- [ ] **Step 3: Run a dry preview digest**

Run: `DRY_RUN=true ./node_modules/.bin/tsx src/cli/sendTest.ts`
Expected:
- process exits successfully
- logs show source-level raw / aiAccepted / aiRejected / capped counts
- HTML artifact is written to `data/output/`
- no SMTP send attempted because `DRY_RUN=true`

- [ ] **Step 4: Commit verification-only changes if needed**

```bash
# Only if verification required tracked-file changes
git add -A
git commit -m "chore: finalize source cap and timeout hardening"
```

---

## Self-Review

### Spec coverage
- AI relevance gate before ranking/truncation: covered by Tasks 1-4
- Per-source top-10 cap before merge/dedupe: covered by Tasks 2-4
- Shared daily/backfill behavior: covered by Task 4
- LLM request timeout hardening: covered by Task 5
- Fallback continuity on timeout: covered by Task 6
- Verification and digest dry run: covered by Task 7

### Placeholder scan
- No `TBD` / `TODO` placeholders remain.
- All code-changing tasks include concrete code blocks and exact commands.

### Type consistency
- `isAiRelevant()` consumes `NormalizedItem`
- `capSourceItems()` returns `{ items, counts }` with `aiAccepted`, `aiRejected`, `capped`
- `IngestionDiagnostics` uses the same optional property names
- `requestChatCompletion()` extends its existing signature with `timeoutMs`

---

Plan complete and saved to `docs/superpowers/plans/2026-05-29-source-cap-and-llm-timeout-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
