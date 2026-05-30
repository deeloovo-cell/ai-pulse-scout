# Daily Full Chinese Digest with Topic Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the daily 07:00 digest to send a full Chinese email with topic coverage, no executive brief, LLM enrichment only for the first 50 items, and fallback summaries for the rest.

**Architecture:** Keep the existing ingestion pipeline (AI filtering, per-source top-10 cap, dedupe, global ordering), then add a daily selection layer that guarantees active-topic coverage while preserving global order. Split rendering into two tiers: the first 50 items get item-level enrichment, remaining items render from deterministic Chinese fallback text. Update the daily renderer and runner so the scheduled 07:00 job uses the production daily entrypoint instead of the test-named CLI.

**Tech Stack:** TypeScript, Node.js, Vitest, launchd shell scripts, existing AI Pulse Scout mail/render pipeline

---

### Task 1: Add topic coverage selection helper

**Files:**
- Create: `src/filtering/selectDailyDigestItems.ts`
- Create: `tests/selectDailyDigestItems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { selectDailyDigestItems } from '../src/filtering/selectDailyDigestItems.js';

function makeItem(id: string, topic: string, hour: string) {
  return {
    id,
    title: id,
    primary_topic: topic,
    published_at: new Date(`2026-05-29T${hour}:00:00.000Z`),
    fetched_at: new Date(`2026-05-29T${hour}:01:00.000Z`),
    item_url: `https://example.com/${id}`,
    source_name: 'Test',
    content_text: 'body',
    summary: 'summary',
    tags: [],
    rawMetadata: {},
  } as any;
}

describe('selectDailyDigestItems', () => {
  it('keeps at least one item for every active topic while preserving global order', () => {
    const ordered = [
      makeItem('a1', 'AI Products & Platforms', '09'),
      makeItem('b1', 'Research & Papers', '08'),
      makeItem('a2', 'AI Products & Platforms', '07'),
      makeItem('c1', 'AI Developer Tools & Agents', '06'),
    ];

    const result = selectDailyDigestItems(ordered);

    expect(result.map((item) => item.id)).toEqual(['a1', 'b1', 'a2', 'c1']);
    expect(new Set(result.map((item) => item.primary_topic))).toEqual(
      new Set(['AI Products & Platforms', 'Research & Papers', 'AI Developer Tools & Agents']),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/selectDailyDigestItems.test.ts`
Expected: FAIL because `src/filtering/selectDailyDigestItems.ts` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
import type { NormalizedItem } from '../types/item.js';

export function selectDailyDigestItems(items: NormalizedItem[]): NormalizedItem[] {
  const seenTopics = new Set<string>();
  const guaranteed: NormalizedItem[] = [];
  const rest: NormalizedItem[] = [];

  for (const item of items) {
    const topic = item.primary_topic;
    if (!seenTopics.has(topic)) {
      seenTopics.add(topic);
      guaranteed.push(item);
    } else {
      rest.push(item);
    }
  }

  const included = new Set(guaranteed.map((item) => item.id));
  return items.filter((item) => included.has(item.id)).concat(rest.filter((item) => !included.has(item.id)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/selectDailyDigestItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filtering/selectDailyDigestItems.ts tests/selectDailyDigestItems.test.ts
git commit -m "feat: add daily topic coverage selection"
```

### Task 2: Add two-tier enrichment helper for first 50 items

**Files:**
- Modify: `src/insights/enrichSelectedItems.ts`
- Create: `tests/enrichSelectedItems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedItem } from '../src/types/item.js';

const enrichKeyInsightsMock = vi.fn(async (items: NormalizedItem[]) =>
  items.map((item) => ({ ...item, key_insight: `llm:${item.id}` })),
);

vi.mock('../src/insights/analyzeKeyInsights.js', () => ({
  enrichKeyInsights: enrichKeyInsightsMock,
}));

function makeItem(index: number): NormalizedItem {
  return {
    id: `item-${index}`,
    title: `item-${index}`,
    primary_topic: 'AI News Roundup',
    published_at: new Date('2026-05-29T09:00:00.000Z'),
    fetched_at: new Date('2026-05-29T09:01:00.000Z'),
    item_url: `https://example.com/${index}`,
    source_name: 'Test',
    content_text: `body ${index}`,
    summary: `summary ${index}`,
    tags: [],
    rawMetadata: {},
  } as any;
}

describe('enrichSelectedItems', () => {
  it('only enriches the first 50 items and still returns all items', async () => {
    const { enrichSelectedItems } = await import('../src/insights/enrichSelectedItems.js');
    const items = Array.from({ length: 60 }, (_, i) => makeItem(i + 1));

    const result = await enrichSelectedItems(items, 50);

    expect(enrichKeyInsightsMock).toHaveBeenCalledTimes(1);
    expect(enrichKeyInsightsMock.mock.calls[0]?.[0]).toHaveLength(50);
    expect(result).toHaveLength(60);
    expect(result[0]?.key_insight).toBe('llm:item-1');
    expect(result[55]?.key_insight).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichSelectedItems.test.ts`
Expected: FAIL because helper currently truncates the returned list to the cap

- [ ] **Step 3: Write minimal implementation**

```ts
import type { NormalizedItem } from '../types/item.js';
import { enrichKeyInsights } from './analyzeKeyInsights.js';

export const DEFAULT_ENRICHMENT_CAP = 50;

export async function enrichSelectedItems(
  items: NormalizedItem[],
  cap = DEFAULT_ENRICHMENT_CAP,
): Promise<NormalizedItem[]> {
  const itemsToEnrich = items.slice(0, cap);
  const enriched = await enrichKeyInsights(itemsToEnrich);
  return enriched.concat(items.slice(cap));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/enrichSelectedItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/insights/enrichSelectedItems.ts tests/enrichSelectedItems.test.ts
git commit -m "feat: cap llm enrichment without truncating digest"
```

### Task 3: Add Chinese topic labels and fallback text

**Files:**
- Create: `src/topics/topicLabels.ts`
- Create: `src/render/buildChineseDigestFallback.ts`
- Create: `tests/buildChineseDigestFallback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildChineseDigestFallback } from '../src/render/buildChineseDigestFallback.js';

describe('buildChineseDigestFallback', () => {
  it('prefers summary and returns Chinese wrapper text', () => {
    const result = buildChineseDigestFallback({
      title: 'AI item',
      summary: 'This is an English summary.',
      content_text: 'Longer content body.',
      key_insight: undefined,
    } as any);

    expect(result).toContain('摘要');
    expect(result).toContain('This is an English summary.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/buildChineseDigestFallback.test.ts`
Expected: FAIL because fallback helper does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
import type { NormalizedItem } from '../types/item.js';

function truncate(text: string, max = 220): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function buildChineseDigestFallback(item: NormalizedItem): string {
  const base = item.key_insight || item.summary || item.content_text || '该条目暂无足够摘要信息，请点击原文查看。';
  return `摘要：${truncate(base)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/buildChineseDigestFallback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/topics/topicLabels.ts src/render/buildChineseDigestFallback.ts tests/buildChineseDigestFallback.test.ts
git commit -m "feat: add chinese digest labels and fallback text"
```

### Task 4: Convert renderer to full Chinese digest with separators and no executive brief

**Files:**
- Modify: `src/render/renderHtmlEmail.ts`
- Test: `tests/renderHtmlEmail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { renderHtmlEmail } from '../src/render/renderHtmlEmail.js';

describe('renderHtmlEmail', () => {
  it('renders Chinese headings, omits executive brief, and shows dividers', () => {
    const html = renderHtmlEmail({
      items: [{
        id: '1',
        title: 'AI item',
        primary_topic: 'AI News Roundup',
        item_url: 'https://example.com/1',
        source_name: 'Test Source',
        published_at: new Date('2026-05-29T09:00:00.000Z'),
        fetched_at: new Date('2026-05-29T09:01:00.000Z'),
        content_text: 'body',
        summary: 'summary',
        tags: [],
        rawMetadata: {},
      } as any],
      date: new Date('2026-05-29T09:00:00.000Z'),
      subjectTemplate: 'AI Pulse Scout — {date} | {count} signals',
      executiveBrief: null,
    });

    expect(html).toContain('AI Pulse Scout');
    expect(html).toContain('今日 AI 情报');
    expect(html).toContain('新闻速览');
    expect(html).not.toContain('Executive brief');
    expect(html).toContain('border-top:2px solid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renderHtmlEmail.test.ts`
Expected: FAIL because renderer is still English and brief-oriented

- [ ] **Step 3: Write minimal implementation**

```ts
// Update renderHtmlEmail.ts to:
// - use Chinese labels
// - use topicLabels mapping for headings
// - remove executive brief block entirely when daily digest renders
// - use stronger divider styles like border-top:2px solid #d7e3f4
// - call buildChineseDigestFallback(item) when item.executive_insight is absent
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/renderHtmlEmail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/render/renderHtmlEmail.ts tests/renderHtmlEmail.test.ts
git commit -m "feat: render daily digest in chinese"
```

### Task 5: Wire daily job to full digest + topic coverage + no executive brief

**Files:**
- Modify: `src/jobs/runDailyDigest.ts`
- Modify: `tests/jobs/runDailyDigest.unifiedIngestion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('returns all selected items, skips executive brief generation, and keeps topic coverage', async () => {
  const module = await import('../../src/jobs/runDailyDigest');
  const result = await module.runDailyDigest();
  expect(result.itemCount).toBeGreaterThan(1);
  expect(result.html).not.toContain('Executive brief');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
Expected: FAIL because daily job still enriches-and-truncates and still builds executive brief

- [ ] **Step 3: Write minimal implementation**

```ts
// In runDailyDigest.ts:
// 1. ordered = selectItems(deduped, config.digest)
// 2. finalItems = selectDailyDigestItems(ordered)
// 3. enrichedItems = await enrichSelectedItems(finalItems, 50)
// 4. do not call generateExecutiveBrief
// 5. renderHtmlEmail({ items: enrichedItems, ..., executiveBrief: null })
// 6. return full itemCount = enrichedItems.length
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/jobs/runDailyDigest.unifiedIngestion.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/jobs/runDailyDigest.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts
git commit -m "feat: switch daily digest to full chinese mode"
```

### Task 6: Point launchd runner to formal production daily CLI

**Files:**
- Create: `src/cli/sendDaily.ts`
- Modify: `scripts/send-daily.sh`
- Test: manual verification via shell command

- [ ] **Step 1: Write the minimal production CLI**

```ts
import 'dotenv/config';
import { runDailyDigest } from '../jobs/runDailyDigest.js';
import { SmtpMailClient, smtpConfigFromEnv } from '../mail/SmtpMailClient.js';
import { logger } from '../utils/logger.js';

logger.info('=== AI Pulse Scout — Daily Send ===');

const smtpConfig = smtpConfigFromEnv();
if (!smtpConfig.user || !smtpConfig.pass) {
  logger.error('SMTP_USER or SMTP_PASS not set in .env');
  process.exit(1);
}

const result = await runDailyDigest(new SmtpMailClient(smtpConfig), true);
console.log('---');
console.log(`Subject: ${result.subject}`);
console.log(`Items:   ${result.itemCount}`);
console.log(`Output:  ${result.outputPath}`);
```

- [ ] **Step 2: Update runner script**

```bash
./node_modules/.bin/tsx src/cli/sendDaily.ts
```

- [ ] **Step 3: Verify script content**

Run: `sed -n '1,220p' scripts/send-daily.sh`
Expected: runner ends with `tsx src/cli/sendDaily.ts`

- [ ] **Step 4: Commit**

```bash
git add src/cli/sendDaily.ts scripts/send-daily.sh
git commit -m "chore: point daily schedule to production cli"
```

### Task 7: Final verification and push

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run focused verification suite**

Run:

```bash
npm test -- \
  tests/selectDailyDigestItems.test.ts \
  tests/enrichSelectedItems.test.ts \
  tests/buildChineseDigestFallback.test.ts \
  tests/renderHtmlEmail.test.ts \
  tests/jobs/runDailyDigest.unifiedIngestion.test.ts \
  tests/chatCompletions.test.ts \
  tests/analyzeKeyInsights.test.ts \
  tests/ingest/ingestAllSources.test.ts \
  tests/isAiRelevant.test.ts \
  tests/capSourceItems.test.ts
```

Expected: PASS with no failed test files

- [ ] **Step 2: Run a real send verification**

Run:

```bash
./node_modules/.bin/tsx src/cli/sendDaily.ts
```

Expected:
- command exits 0
- subject prints successfully
- item count reflects full digest, not 12-item truncation
- sent email is Chinese and contains no executive brief block

- [ ] **Step 3: Reload launchd agent**

Run:

```bash
./scripts/install-schedule.sh
launchctl list | grep com.ai-pulse-scout.daily
```

Expected:
- agent loads successfully
- label `com.ai-pulse-scout.daily` appears

- [ ] **Step 4: Commit final polish if needed**

```bash
git add src/cli/sendDaily.ts src/filtering/selectDailyDigestItems.ts src/insights/enrichSelectedItems.ts src/render/buildChineseDigestFallback.ts src/render/renderHtmlEmail.ts src/jobs/runDailyDigest.ts src/topics/topicLabels.ts scripts/send-daily.sh tests/selectDailyDigestItems.test.ts tests/enrichSelectedItems.test.ts tests/buildChineseDigestFallback.test.ts tests/renderHtmlEmail.test.ts tests/jobs/runDailyDigest.unifiedIngestion.test.ts
git commit -m "test: verify chinese full daily digest flow"
```

- [ ] **Step 5: Push branch**

```bash
git push origin feature/ai-pulse-scout-mvp
```

## Self-review

- Spec coverage: plan covers full daily digest, topic coverage, first-50 enrichment cap, Chinese renderer, executive-brief removal, layout divider changes, and launchd production CLI update.
- Placeholder scan: all tasks name concrete files, commands, and expected outcomes. One implementation step in Task 4 and Task 5 is intentionally declarative because the exact renderer/job diff depends on current file structure, but the affected file and behavior are explicit.
- Type consistency: `selectDailyDigestItems`, `enrichSelectedItems`, and `buildChineseDigestFallback` are used consistently across later tasks. `DEFAULT_ENRICHMENT_CAP` is now 50 by design.
