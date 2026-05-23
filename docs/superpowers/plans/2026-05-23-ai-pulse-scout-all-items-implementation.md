# AI Pulse Scout All-Items Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change AI Pulse Scout from a filtered digest into a complete latest-items email that includes all deduplicated items from the fetch window, ordered by score only, with clearly visible per-item links.

**Architecture:** Keep the existing fetch → dedupe → score pipeline intact, replace subset selection with all-item ordering, and make the renderer show distinct item URLs clearly. Preserve existing send/state behavior so the only substantive behavior change is that items are no longer excluded by score threshold or top-N cap.

**Tech Stack:** TypeScript, Node.js, Vitest, existing AI Pulse Scout pipeline under `ai-pulse-scout/`

---

## File Structure / Responsibility Map

- Modify: `ai-pulse-scout/src/filtering/selectItems.ts`
  - Change from threshold + top-N selection to all-item ordering.
- Modify: `ai-pulse-scout/src/jobs/runDailyDigest.ts`
  - Keep daily pipeline wired to the updated ordering behavior.
- Modify: `ai-pulse-scout/src/render/renderHtmlEmail.ts`
  - Update header framing and show clear visible link text per item.
- Modify: `ai-pulse-scout/tests/render.test.ts`
  - Verify visible link rendering and updated header framing.
- Modify: `ai-pulse-scout/tests/emptyDigestBehavior.test.ts`
  - Keep zero-item behavior verified after pipeline change.
- Create: `ai-pulse-scout/tests/selectItems.test.ts`
  - Verify no threshold exclusion, no top-N truncation, and stable score ordering.
- Modify: `ai-pulse-scout/README.md`
  - Update product description from filtered digest to all-items ordered email.

---

### Task 1: Add tests for all-item ordering behavior

**Files:**
- Create: `ai-pulse-scout/tests/selectItems.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, expect, it } from 'vitest';
import { selectItems } from '../src/filtering/selectItems.js';
import type { NormalizedItem } from '../src/types/item.js';
import type { DigestConfig } from '../src/types/config.js';

function makeItem(overall: number, title: string, publishedAt: string): NormalizedItem {
  const published = new Date(publishedAt);
  return {
    source_name: 'Test Source',
    source_category: 'ai_engineering',
    source_url: 'https://example.com/feed.xml',
    item_url: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    summary: `${title} summary`,
    content_text: `${title} content`,
    published_at: published,
    fingerprint: `fp-${title}`,
    relevance_scores: {
      ai_engineering: overall,
      industrial_ai: 0,
      cad_cae_cam: 0,
      executive_signal: 0,
      aac_relevance: 0,
      overall,
    },
    decision: 'exclude',
    decision_reason: '',
  };
}

describe('selectItems', () => {
  const config: DigestConfig = {
    max_items: 2,
    min_items: 3,
    collection_window_hours: 28,
    safety_buffer_hours: 2,
    min_score: 0.9,
  };

  it('returns all items even when some are below the old score threshold', () => {
    const items = [
      makeItem(0.95, 'High Score', '2026-05-23T00:00:00.000Z'),
      makeItem(0.10, 'Low Score', '2026-05-23T01:00:00.000Z'),
      makeItem(0.40, 'Mid Score', '2026-05-23T02:00:00.000Z'),
    ];

    const result = selectItems(items, config);

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.title)).toEqual(['High Score', 'Mid Score', 'Low Score']);
    expect(result.every((item) => item.decision === 'include')).toBe(true);
  });

  it('does not truncate to the old max_items limit', () => {
    const items = [
      makeItem(0.80, 'Item One', '2026-05-23T00:00:00.000Z'),
      makeItem(0.70, 'Item Two', '2026-05-23T01:00:00.000Z'),
      makeItem(0.60, 'Item Three', '2026-05-23T02:00:00.000Z'),
      makeItem(0.50, 'Item Four', '2026-05-23T03:00:00.000Z'),
    ];

    const result = selectItems(items, config);

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.title)).toEqual(['Item One', 'Item Two', 'Item Three', 'Item Four']);
  });

  it('uses published date as a descending tiebreaker when scores are equal', () => {
    const items = [
      makeItem(0.50, 'Older Item', '2026-05-23T00:00:00.000Z'),
      makeItem(0.50, 'Newer Item', '2026-05-23T03:00:00.000Z'),
    ];

    const result = selectItems(items, config);

    expect(result.map((item) => item.title)).toEqual(['Newer Item', 'Older Item']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/selectItems.test.ts
```

Expected: FAIL because current `selectItems()` still filters by `min_score` and truncates to `max_items`, and does not guarantee the published-date tiebreaker.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/selectItems.test.ts
git commit -m "test: define all-items ordering behavior"
```

---

### Task 2: Implement all-item ordering in the selection stage

**Files:**
- Modify: `ai-pulse-scout/src/filtering/selectItems.ts`
- Test: `ai-pulse-scout/tests/selectItems.test.ts`

- [ ] **Step 1: Replace selection logic with all-item ordering**

Update `ai-pulse-scout/src/filtering/selectItems.ts` to:

```ts
import type { NormalizedItem } from '../types/item.js';
import type { DigestConfig } from '../types/config.js';

function publishedTime(item: NormalizedItem): number {
  return item.published_at ? item.published_at.getTime() : 0;
}

export function selectItems(items: NormalizedItem[], _config: DigestConfig): NormalizedItem[] {
  const sorted = [...items].sort((a, b) => {
    if (b.relevance_scores.overall !== a.relevance_scores.overall) {
      return b.relevance_scores.overall - a.relevance_scores.overall;
    }
    return publishedTime(b) - publishedTime(a);
  });

  return sorted.map((item) => ({
    ...item,
    decision: 'include' as const,
    decision_reason: `ordered score=${item.relevance_scores.overall.toFixed(2)}`,
  }));
}
```

- [ ] **Step 2: Run targeted tests**

Run:
```bash
npm test -- tests/selectItems.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit the implementation**

```bash
git add src/filtering/selectItems.ts tests/selectItems.test.ts
git commit -m "feat: include all scored items in digest ordering"
```

---

### Task 3: Add renderer tests for visible URLs and all-items framing

**Files:**
- Modify: `ai-pulse-scout/tests/render.test.ts`

- [ ] **Step 1: Add failing assertions for the renderer**

Append or adapt tests in `ai-pulse-scout/tests/render.test.ts` so they cover both the header and visible link text:

```ts
import { describe, expect, it } from 'vitest';
import { renderHtmlEmail } from '../src/render/renderHtmlEmail.js';
import type { NormalizedItem } from '../src/types/item.js';

const baseItem: NormalizedItem = {
  source_name: 'Example Source',
  source_category: 'ai_engineering',
  source_url: 'https://example.com/feed.xml',
  item_url: 'https://example.com/posts/visible-link',
  title: 'Visible Link Item',
  summary: 'Short summary',
  content_text: 'Full content',
  published_at: new Date('2026-05-23T00:00:00.000Z'),
  fingerprint: 'fp-visible-link',
  relevance_scores: {
    ai_engineering: 0.8,
    industrial_ai: 0,
    cad_cae_cam: 0,
    executive_signal: 0.5,
    aac_relevance: 0,
    overall: 0.8,
  },
  decision: 'include',
  decision_reason: 'ordered score=0.80',
};

describe('renderHtmlEmail', () => {
  it('shows all-items framing in the header', () => {
    const html = renderHtmlEmail({
      items: [baseItem],
      date: new Date('2026-05-23T00:00:00.000Z'),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('All Latest Items');
    expect(html).toContain('1 items');
  });

  it('shows the actual destination URL in visible text', () => {
    const html = renderHtmlEmail({
      items: [baseItem],
      date: new Date('2026-05-23T00:00:00.000Z'),
      subjectTemplate: 'AI Pulse Scout -- {date}',
    });

    expect(html).toContain('Open link:');
    expect(html).toContain('https://example.com/posts/visible-link');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/render.test.ts
```

Expected: FAIL because current renderer does not include the “All Latest Items” framing or visible URL text.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/render.test.ts
git commit -m "test: define visible URL rendering for all-items email"
```

---

### Task 4: Update the HTML renderer

**Files:**
- Modify: `ai-pulse-scout/src/render/renderHtmlEmail.ts`
- Test: `ai-pulse-scout/tests/render.test.ts`

- [ ] **Step 1: Update header framing and visible link presentation**

Edit `ai-pulse-scout/src/render/renderHtmlEmail.ts` so the relevant parts look like this:

```ts
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
      <p style="margin:4px 0 0 0;font-size:13px;color:#666;">All Latest Items</p>
      <p style="margin:4px 0 0 0;font-size:13px;color:#666;">${escapeHtml(formatDigestDate(date))} &nbsp;|&nbsp; ${items.length} items</p>
    </td>
  </tr>
  ${itemsHtml}
  <tr>
    <td style="padding:20px;font-size:11px;color:#999;border-top:1px solid #e0e0e0;text-align:center;">
      AI Pulse Scout &mdash; all latest items &mdash; ${escapeHtml(formatDigestDate(date))}
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
    <td style="padding:16px 20px;background:${bgColor};border-bottom:1px solid #e0e0e0;word-break:break-word;overflow-wrap:anywhere;">
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
      <p style="margin:10px 0 0 0;font-size:12px;color:#444;">
        <strong>Source:</strong> ${escapeHtml(item.source_name)}
        &nbsp;<span style="color:#999;font-size:11px;">${formatPublished(item.published_at)}</span>
      </p>
      <p style="margin:6px 0 0 0;font-size:12px;word-break:break-word;overflow-wrap:anywhere;">
        <strong>Open link:</strong>
        <a href="${escapeHtml(item.item_url)}" style="color:#1a73e8;text-decoration:none;">
          ${escapeHtml(item.item_url)}
        </a>
      </p>
    </td>
  </tr>`;
}
```

- [ ] **Step 2: Run targeted tests**

Run:
```bash
npm test -- tests/render.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit the implementation**

```bash
git add src/render/renderHtmlEmail.ts tests/render.test.ts
git commit -m "feat: show all-items framing and visible links"
```

---

### Task 5: Verify daily job behavior still works with zero items

**Files:**
- Modify: `ai-pulse-scout/tests/emptyDigestBehavior.test.ts`

- [ ] **Step 1: Update or add a focused regression test**

Ensure `ai-pulse-scout/tests/emptyDigestBehavior.test.ts` verifies this behavior explicitly:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runDailyDigest } from '../src/jobs/runDailyDigest.js';

vi.mock('../src/config/loadConfig.js', () => ({
  loadConfig: () => ({
    digest: {
      max_items: 12,
      min_items: 3,
      collection_window_hours: 28,
      safety_buffer_hours: 2,
      min_score: 0.15,
    },
    email: {
      to: 'test@example.com',
      subject_template: 'AI Pulse Scout -- {date}',
      from_name: 'AI Pulse Scout',
      from_address: 'pulse@example.com',
    },
    scoring: {
      ai_engineering_keywords: [],
      industrial_ai_keywords: [],
      cad_cae_cam_keywords: [],
      executive_signal_keywords: [],
      aac_relevance_keywords: [],
      high_signal_boost_keywords: [],
      low_signal_penalty_keywords: [],
    },
    sources: [],
  }),
}));

vi.mock('../src/fetchers/rssFetcher.js', () => ({
  fetchAllSources: async () => [],
}));

vi.mock('../src/state/runState.js', () => ({
  loadRunState: () => ({ last_successful_run: null, run_count: 0 }),
  saveSuccessfulRun: vi.fn(),
}));

vi.mock('../src/state/ledger.js', () => ({
  loadLedger: () => ({ urls: new Set(), fingerprints: new Set() }),
  appendToLedger: vi.fn(),
}));

describe('runDailyDigest empty behavior', () => {
  it('skips send and returns zero items when nothing remains after fetch', async () => {
    const mailClient = { send: vi.fn() };

    const result = await runDailyDigest(mailClient as any, true);

    expect(result.itemCount).toBe(0);
    expect(mailClient.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
npm test -- tests/emptyDigestBehavior.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit the regression coverage**

```bash
git add tests/emptyDigestBehavior.test.ts
git commit -m "test: preserve empty all-items digest behavior"
```

---

### Task 6: Update README language and usage expectations

**Files:**
- Modify: `ai-pulse-scout/README.md`

- [ ] **Step 1: Update the README copy**

Change the relevant sections in `ai-pulse-scout/README.md` to this wording:

```md
# AI Pulse Scout

A portable TypeScript project that automatically collects AI news from a curated source list, deduplicates and scores the latest items, orders them globally by relevance, renders a complete HTML latest-items email, and sends it via SMTP.
```

And update the email-format section to:

```md
## Email Format

- Subject: `AI Pulse Scout -- MM-DD-YYYY`
- Includes all deduplicated latest items from the current collection window
- Items are globally ordered by relevance score
- Each item shows a clear visible destination link
```

- [ ] **Step 2: Commit the docs update**

```bash
git add README.md
git commit -m "docs: describe all-items email behavior"
```

---

### Task 7: Run the focused verification suite

**Files:**
- Modify: none
- Test: `ai-pulse-scout/tests/selectItems.test.ts`
- Test: `ai-pulse-scout/tests/render.test.ts`
- Test: `ai-pulse-scout/tests/emptyDigestBehavior.test.ts`

- [ ] **Step 1: Run focused tests**

Run:
```bash
npm test -- tests/selectItems.test.ts tests/render.test.ts tests/emptyDigestBehavior.test.ts
```

Expected: PASS with all three test files green.

- [ ] **Step 2: Run full test suite**

Run:
```bash
npm test
```

Expected: PASS with no regressions.

- [ ] **Step 3: Commit the verified feature state**

```bash
git add src/filtering/selectItems.ts src/render/renderHtmlEmail.ts tests/selectItems.test.ts tests/render.test.ts tests/emptyDigestBehavior.test.ts README.md
git commit -m "feat: send all latest digest items in score order"
```

---

## Self-Review

### Spec coverage
- Include all latest fetched items from enabled sources: covered by Tasks 1–2
- Keep dedupe: preserved and regression-checked in Tasks 5 and 7
- Keep scoring only for ordering: covered by Tasks 1–2 and verified in Task 7
- Render one global list: covered by Task 2 and renderer behavior in Task 4
- Make link clearly visible: covered by Tasks 3–4
- Keep it simple / no grouping or archive complexity: reflected throughout; no extra tasks added

### Placeholder scan
No TBD/TODO placeholders remain. Each task has exact files, commands, and code.

### Type consistency
- `selectItems()` remains the callable entry point expected by `runDailyDigest.ts`
- `NormalizedItem` field names match existing code (`item_url`, `published_at`, `relevance_scores`)
- Tests consistently use the same score and decision shape expected by renderer/filtering code

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-ai-pulse-scout-all-items-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
