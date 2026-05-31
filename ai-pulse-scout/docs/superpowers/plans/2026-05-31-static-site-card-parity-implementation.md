# Static Site Card Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the AI Pulse Scout static-site cards to match the approved mockup direction by rendering match %, Chinese topic badges, enrichment-first Chinese summaries, and display-only relevance/follow-up UI without changing deployment behavior.

**Architecture:** Keep the implementation renderer-first. Extend the static-site rendering layer to produce the richer card markup and styling, add only the minimum field-shaping helpers needed to expose topic badges and display metadata, and preserve the existing static export/build entrypoints. Verification should combine targeted renderer tests with a fresh generated HTML inspection.

**Tech Stack:** TypeScript, Vitest, existing static export pipeline, Node.js

---

## File Map

### Primary files
- Modify: `ai-pulse-scout/src/static/renderStaticSite.ts` — replace the minimal card renderer with the mockup-aligned card layout, summary fallback logic, match-pill display, topic badges, and footer metadata
- Modify: `ai-pulse-scout/tests/static/renderStaticSite.test.ts` — cover the new card structure, negative cases, and summary fallback behavior

### Possible support files
- Modify: `ai-pulse-scout/src/static/exportStaticSite.ts` — only if the renderer cannot currently receive enrichment-oriented fields needed for the card body
- Modify: `ai-pulse-scout/src/types/item.ts` — only if a minimal optional field type must be surfaced to the renderer
- Modify: `ai-pulse-scout/tests/static/exportStaticSite.test.ts` — only if export shaping changes are required

### Verification surfaces
- Inspect generated output under: `ai-pulse-scout/data/output/site/index.html`
- Inspect generated output under: `ai-pulse-scout/data/output/site/days/<date>.html`

## Task 1: Lock current renderer inputs and expected field availability

**Files:**
- Read: `ai-pulse-scout/src/static/renderStaticSite.ts`
- Read: `ai-pulse-scout/src/static/exportStaticSite.ts`
- Read: `ai-pulse-scout/src/types/item.ts`
- Read: `ai-pulse-scout/tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Re-read the renderer and item type definitions**

Confirm whether `NormalizedItem` or the static export layer already carries enough fields for:
- enrichment-like summary content
- source/topic hints
- any ranking/order metadata that can be mapped to a display percentage

Expected outcome:
- either “renderer already has enough data”
- or “one minimal shaping addition is required upstream”

- [ ] **Step 2: Record the exact data contract before editing**

Write down a short implementation note in your scratchpad with these answers:
- Which field will be used first for card body text?
- Which field(s) can support topic badge inference?
- How will match % be derived if no explicit score exists?

No code changes in this task.

## Task 2: Add failing renderer tests for the approved card structure

**Files:**
- Modify: `ai-pulse-scout/tests/static/renderStaticSite.test.ts`
- Test: `ai-pulse-scout/tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Add a failing test for the richer card layout**

Add a test shaped like this:

```ts
it('renders match pill, Chinese topic badges, and footer metadata for each item', () => {
  const html = renderStaticIndexPage({
    siteTitle: 'AI Pulse Scout',
    targetDate: '2026-05-31',
    recentDays: ['2026-05-31'],
    items: [
      {
        id: 'item-1',
        title: 'Agentic coding workflow improves triage quality',
        summary: '普通摘要',
        content_text: 'Longer raw fallback text for the item body.',
        item_url: 'https://example.com/item-1',
        source_name: 'Example Source',
      } as any,
    ],
  });

  expect(html).toContain('match');
  expect(html).toContain('Relevant rank');
  expect(html).toContain('Follow-up');
  expect(html).toMatch(/大模型|智能体|AI 基础设施|计算机视觉/);
});
```

- [ ] **Step 2: Add a failing test for summary fallback priority**

Add a second test shaped like this:

```ts
it('prefers enrichment-style summary content over plain summary and raw snippet', () => {
  const html = renderStaticDayPage({
    siteTitle: 'AI Pulse Scout',
    targetDate: '2026-05-31',
    homeHref: '../index.html',
    items: [
      {
        id: 'item-2',
        title: 'Multimodal model reduces annotation cost',
        summary: '普通摘要不应优先出现',
        content_text: 'raw snippet fallback text',
        item_url: 'https://example.com/item-2',
        source_name: 'Example Source',
        why_it_matters: '这项工作更值得关注，因为它把多模态训练成本压低到了更易部署的水平。它同时展示了数据效率和工程可落地性的改进。',
      } as any,
    ],
  });

  expect(html).toContain('这项工作更值得关注');
  expect(html).not.toContain('普通摘要不应优先出现');
});
```

- [ ] **Step 3: Add a failing test for negative UI requirements**

Add a third test shaped like this:

```ts
it('does not render raw source-origin labels such as arXiv category tags', () => {
  const html = renderStaticIndexPage({
    siteTitle: 'AI Pulse Scout',
    targetDate: '2026-05-31',
    recentDays: ['2026-05-31'],
    items: [
      {
        id: 'item-3',
        title: 'Vision-language system improves robotics planning',
        summary: '摘要',
        content_text: 'raw content',
        item_url: 'https://arxiv.org/abs/1234.5678',
        source_name: 'arXiv cs.AI',
      } as any,
    ],
  });

  expect(html).not.toContain('cs.AI');
  expect(html).not.toContain('cs.LG');
  expect(html).not.toContain('arXiv cs.AI');
});
```

- [ ] **Step 4: Run the renderer test file and confirm failure**

Run:
```bash
npx vitest run tests/static/renderStaticSite.test.ts
```

Expected:
- FAIL
- at least one assertion fails because the current renderer only outputs title/summary/source/url metadata

- [ ] **Step 5: Commit the failing tests**

Run:
```bash
git add tests/static/renderStaticSite.test.ts
git commit -m "test: cover static site card parity"
```

## Task 3: Implement renderer-first card parity helpers and markup

**Files:**
- Modify: `ai-pulse-scout/src/static/renderStaticSite.ts`
- Test: `ai-pulse-scout/tests/static/renderStaticSite.test.ts`

- [ ] **Step 1: Add renderer helpers for summary selection and safe text extraction**

Add helper functions near the top of `src/static/renderStaticSite.ts` like:

```ts
function getPreferredSummary(item: NormalizedItem): string {
  const candidateFields = [
    (item as NormalizedItem & { why_it_matters?: string }).why_it_matters,
    item.summary,
    item.content_text,
  ];

  const text = candidateFields.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
  return text.slice(0, 320);
}

function compactSourceText(value: string): string {
  return value.replace(/arxiv/gi, '').replace(/cs\.[A-Z]+/g, '').replace(/\s+/g, ' ').trim();
}
```

Notes:
- `getPreferredSummary()` must honor the agreed fallback order
- do not emit source-origin labels into visible topic-badge output

- [ ] **Step 2: Add helper functions for display-only topic badges and match percentage**

Add helpers like:

```ts
function inferTopicBadges(item: NormalizedItem): string[] {
  const corpus = `${item.title} ${item.summary ?? ''} ${item.content_text}`.toLowerCase();

  if (/(agent|agentic|workflow)/.test(corpus)) return ['智能体'];
  if (/(multimodal|vision-language|vlm)/.test(corpus)) return ['多模态'];
  if (/(llm|language model|gpt|reasoning)/.test(corpus)) return ['大模型'];
  if (/(vision|image|video)/.test(corpus)) return ['计算机视觉'];
  if (/(robot|robotics)/.test(corpus)) return ['机器人'];
  if (/(protein|drug|biotech|genomics)/.test(corpus)) return ['生物医药'];
  if (/(climate|energy|carbon)/.test(corpus)) return ['气候科技'];

  return ['AI 基础设施'];
}

function computeDisplayMatch(index: number, total: number): number {
  if (total <= 1) return 92;
  const ratio = 1 - index / Math.max(total - 1, 1);
  return Math.max(61, Math.min(95, Math.round(61 + ratio * 34)));
}
```

Rules:
- keep badge count to 1-2 max
- keep labels in Chinese
- use a stable, display-oriented percentage

- [ ] **Step 3: Replace the old minimal card HTML with the approved richer structure**

Update `renderItems()` so each item renders markup shaped like:

```ts
return items.map((item, index) => {
  const badges = inferTopicBadges(item);
  const match = computeDisplayMatch(index, items.length);
  const summary = getPreferredSummary(item);
  const stars = match >= 90 ? '★★★★★' : match >= 80 ? '★★★★☆' : match >= 70 ? '★★★☆☆' : '★★☆☆☆';

  return `
    <article class="digest-card">
      <div class="card-top">
        <span class="match-pill match-${match >= 80 ? 'high' : match >= 60 ? 'mid' : 'low'}">${match}% match</span>
        <div class="topic-badges">${badges.map((badge) => `<span class="topic-badge">${escapeHtml(badge)}</span>`).join('')}</div>
      </div>
      <h2 class="digest-title">
        <a href="${escapeHtml(item.item_url)}">${escapeHtml(item.title)}</a>
      </h2>
      <p class="digest-summary">${escapeHtml(summary)}</p>
      <div class="card-footer">
        <div class="footer-group">
          <span class="footer-label">Relevant rank</span>
          <span class="footer-value">${stars}</span>
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
```

Requirements:
- remove the visible source/url metadata row from the card body
- keep title link behavior intact
- do not emit source-origin tags

- [ ] **Step 4: Replace the old stylesheet block with mockup-aligned card styling**

Update the inline CSS in `renderShell()` to include styles for:

```css
body { background: #f6f5fb; color: #1f2937; }
.content { background: #ffffff; border: 1px solid #e6e4f2; border-radius: 18px; box-shadow: 0 12px 36px rgba(83, 74, 183, 0.08); }
.digest-card { padding: 20px; border-top: 1px solid #eceaf5; display: flex; flex-direction: column; gap: 10px; }
.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.match-pill { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; }
.match-high { background: #eaf3de; color: #3b6d11; }
.match-mid { background: #faeeda; color: #ba7517; }
.match-low { background: #fcebeb; color: #a32d2d; }
.topic-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.topic-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #eeedfe; color: #3c3489; }
.digest-summary { font-size: 14px; line-height: 1.75; color: #4b5563; }
.card-footer { display: flex; align-items: center; gap: 14px; padding-top: 10px; border-top: 1px solid #eceaf5; }
.footer-label { font-size: 12px; color: #6b7280; }
.footer-value, .followup-pill { font-size: 12px; font-weight: 600; }
.followup-pill { color: #534ab7; }
```

Requirements:
- keep the page readable on mobile
- visually move away from the current minimal white-card layout toward the approved mockup style

- [ ] **Step 5: Run renderer tests and confirm they pass**

Run:
```bash
npx vitest run tests/static/renderStaticSite.test.ts
```

Expected:
- PASS
- new tests confirm card structure, summary priority, and negative source-label behavior

- [ ] **Step 6: Commit the renderer implementation**

Run:
```bash
git add src/static/renderStaticSite.ts tests/static/renderStaticSite.test.ts
git commit -m "feat: align static site cards with mockup"
```

## Task 4: Add minimal upstream shaping only if renderer lacks enrichment access

**Files:**
- Modify if needed: `ai-pulse-scout/src/static/exportStaticSite.ts`
- Modify if needed: `ai-pulse-scout/src/types/item.ts`
- Test if needed: `ai-pulse-scout/tests/static/exportStaticSite.test.ts`

- [ ] **Step 1: Decide whether this task is needed**

If Task 1 confirmed that `renderStaticSite.ts` can already access the needed summary/enrichment-oriented fields, skip this task entirely and leave a note in the final verification.

If needed, continue with the remaining steps.

- [ ] **Step 2: Add a failing export-shaping test**

If the renderer cannot see the enrichment field, add a focused test like:

```ts
it('passes enrichment-oriented summary fields through static export shaping', async () => {
  const result = await exportStaticSite(/* existing test fixture input */);
  expect(result.indexHtml).toContain('这项工作更值得关注');
});
```

- [ ] **Step 3: Run the focused export test and confirm failure**

Run:
```bash
npx vitest run tests/static/exportStaticSite.test.ts
```

Expected:
- FAIL because the export layer does not yet surface the needed field

- [ ] **Step 4: Implement the smallest possible shaping change**

Only add optional field plumbing required for the renderer contract, for example:

```ts
type StaticRenderableItem = NormalizedItem & {
  why_it_matters?: string;
};
```

or pass through the already-generated field in the export mapping rather than recomputing anything.

- [ ] **Step 5: Re-run the focused export test and confirm pass**

Run:
```bash
npx vitest run tests/static/exportStaticSite.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the shaping change**

Run:
```bash
git add src/static/exportStaticSite.ts src/types/item.ts tests/static/exportStaticSite.test.ts
git commit -m "feat: expose enrichment fields to static renderer"
```

## Task 5: End-to-end verification with generated HTML

**Files:**
- Inspect: `ai-pulse-scout/data/output/site/index.html`
- Inspect: `ai-pulse-scout/data/output/site/days/2026-05-31.html`

- [ ] **Step 1: Run the focused static-site tests**

Run:
```bash
npx vitest run tests/static/renderStaticSite.test.ts tests/static/exportStaticSite.test.ts
```

Expected:
- PASS
- if Task 4 was skipped, run only the renderer test file and note the reason

- [ ] **Step 2: Regenerate the site for a real date**

Run:
```bash
npm run site:export -- --date 2026-05-31
```

Expected:
- command exits 0
- output mentions generated static site files under `data/output/site`

- [ ] **Step 3: Inspect the generated index page for required structures**

Run:
```bash
rg -n "match|Relevant rank|Follow-up|topic-badge|digest-summary" data/output/site/index.html
```

Expected:
- hits confirming the richer card structure exists in generated HTML

- [ ] **Step 4: Inspect generated HTML for forbidden source-origin labels**

Run:
```bash
rg -n "cs\.AI|cs\.LG|arXiv cs" data/output/site/index.html data/output/site/days/2026-05-31.html
```

Expected:
- no matches

- [ ] **Step 5: Manually inspect one generated card body for enrichment-first content**

Run:
```bash
sed -n '1,220p' data/output/site/days/2026-05-31.html
```

Expected:
- card body text reads like processed Chinese summary content
- not just a raw clipped source snippet

- [ ] **Step 6: Commit verification-safe final changes**

Run:
```bash
git status --short
git add src/static/renderStaticSite.ts tests/static/renderStaticSite.test.ts src/static/exportStaticSite.ts src/types/item.ts tests/static/exportStaticSite.test.ts
git commit -m "test: verify static site card parity" || true
```

Expected:
- if there are no new tracked changes after prior commits, the commit may be a no-op
- do not force a dummy change just to create a commit

## Self-Review Checklist

Spec coverage cross-check:
- mockup-aligned card structure → Task 2, Task 3, Task 5
- Chinese topic badges only → Task 2, Task 3, Task 5
- enrichment-first summary priority → Task 2, Task 3, Task 4, Task 5
- display-only relevance/follow-up → Task 2, Task 3, Task 5
- preserve build/export behavior → Task 4, Task 5

Placeholder scan:
- no TODO/TBD placeholders remain
- all commands and test examples are explicit
- optional upstream shaping is isolated behind a decision gate instead of assumed

Type consistency:
- renderer helper names are consistent across tasks: `getPreferredSummary`, `inferTopicBadges`, `computeDisplayMatch`
- if upstream shaping is needed, it only passes through optional enrichment-oriented fields already implied by the spec
