# AI Pulse Scout Email Template Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the AI Pulse Scout email brand, remove the manufacturing subtitle, refocus the executive brief toward productivity and implementation, and remove the fixed 12-item cap from executive-brief generation.

**Architecture:** Update email config and HTML rendering so the visible brand and labels match the new direction, then update the executive brief type/prompt/parser flow so the generated brief uses productivity-oriented fields and considers all selected items from the 24-hour digest window. Keep the existing digest-selection pipeline unchanged and preserve graceful fallback behavior when LLM generation fails.

**Tech Stack:** TypeScript, Node.js, YAML config, existing digest rendering and LLM helper pipeline, Vitest/Jest-style project tests

---

## File map

- Modify: `ai-pulse-scout/config/email.yaml`
  - Restore sender brand and subject template wording.
- Modify: `ai-pulse-scout/src/render/renderHtmlEmail.ts`
  - Update header copy, remove subtitle, and render new executive brief labels.
- Modify: `ai-pulse-scout/src/types/executive.ts`
  - Rename the `ExecutiveBrief` fields to match the new semantics.
- Modify: `ai-pulse-scout/src/insights/parseExecutiveInsight.ts`
  - Parse the new executive-brief JSON keys and update fallback brief helpers if needed.
- Modify: `ai-pulse-scout/src/insights/generateExecutiveBrief.ts`
  - Rewrite prompt wording, remove the `slice(0, 12)` cap, and update fallback brief wording.
- Modify: `ai-pulse-scout/src/jobs/runDailyDigest.ts`
  - Keep wiring aligned with the renamed `ExecutiveBrief` type if compile fixes are needed.
- Modify: `ai-pulse-scout/tests/...`
  - Update or add tests for subject rendering, header rendering, brief rendering, parser behavior, and no-fixed-cap context generation.

---

### Task 1: Update brand wording in config and email header

**Files:**
- Modify: `ai-pulse-scout/config/email.yaml`
- Modify: `ai-pulse-scout/src/render/renderHtmlEmail.ts`
- Test: `ai-pulse-scout/tests/renderHtmlEmail.test.ts`

- [ ] **Step 1: Write the failing render test for restored branding and removed subtitle**

```ts
import { describe, expect, test } from 'vitest';
import { renderHtmlEmail, buildSubject } from '../src/render/renderHtmlEmail.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    title: 'Example signal',
    item_url: 'https://example.com/item',
    source_name: 'Example Source',
    primary_topic: 'AI Research',
    published_at: new Date('2026-05-28T12:00:00Z'),
    content_text: 'Example content',
    summary: 'Example summary',
    key_insight: 'Example insight',
    content_type: 'article',
    rawMetadata: {},
    ...overrides,
  } as NormalizedItem;
}

describe('renderHtmlEmail branding', () => {
  test('restores AI Pulse Scout brand and omits manufacturing subtitle', () => {
    const html = renderHtmlEmail({
      items: [makeItem()],
      date: new Date('2026-05-28T12:00:00Z'),
      subjectTemplate: 'AI Pulse Scout — {date} | {count} signals',
      executiveBrief: null,
    });

    expect(buildSubject('AI Pulse Scout — {date} | {count} signals', new Date('2026-05-28T12:00:00Z'), 1))
      .toContain('AI Pulse Scout');
    expect(html).toContain('AI Pulse Scout');
    expect(html).not.toContain('Manufacturing AI Pulse');
    expect(html).not.toContain('CIO / Chief AI Officer brief');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test -- renderHtmlEmail
```

Expected: FAIL because the current HTML still contains `Manufacturing AI Pulse` and the subtitle line.

- [ ] **Step 3: Update the config brand and subject template**

```yaml
email:
  to: "deeloovo@gmail.com"
  from_name: "AI Pulse Scout"
  from_address: ""
  subject_template: "AI Pulse Scout — {date} | {count} signals"
  reply_to: ""
```

- [ ] **Step 4: Update the email header rendering**

```ts
  <tr>
    <td style="padding:24px 20px 14px 20px;border-bottom:3px solid ${ACCENT};">
      <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:bold;">AI Pulse Scout</h1>
      <p style="margin:6px 0 0 0;font-size:13px;color:#555;line-height:1.5;">
        ${escapeHtml(formatDigestDate(date))} &nbsp;|&nbsp; ${items.length} signal${items.length === 1 ? '' : 's'} &nbsp;|&nbsp; Last 24 hours
      </p>
    </td>
  </tr>
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
pnpm test -- renderHtmlEmail
```

Expected: PASS with the restored brand and no subtitle.

- [ ] **Step 6: Commit**

```bash
git add ai-pulse-scout/config/email.yaml ai-pulse-scout/src/render/renderHtmlEmail.ts ai-pulse-scout/tests/renderHtmlEmail.test.ts
git commit -m "feat: restore AI Pulse Scout email branding"
```

### Task 2: Rename executive brief fields and renderer labels

**Files:**
- Modify: `ai-pulse-scout/src/types/executive.ts`
- Modify: `ai-pulse-scout/src/render/renderHtmlEmail.ts`
- Test: `ai-pulse-scout/tests/renderHtmlEmail.test.ts`

- [ ] **Step 1: Write the failing render test for new executive brief labels**

```ts
test('renders productivity-oriented executive brief labels', () => {
  const html = renderHtmlEmail({
    items: [makeItem()],
    date: new Date('2026-05-28T12:00:00Z'),
    subjectTemplate: 'AI Pulse Scout — {date} | {count} signals',
    executiveBrief: {
      productivity_upside: 'Reduce repetitive engineering review time.',
      adoption_implementation_risk: 'ERP integration quality may slow rollout.',
      technical_signal: 'A stronger agent-eval pattern is emerging.',
      suggested_action: 'Review the top two items with the platform lead.',
    },
  });

  expect(html).toContain('Productivity upside');
  expect(html).toContain('Adoption / implementation risk');
  expect(html).toContain('Technical signal');
  expect(html).toContain('Suggested action');
  expect(html).not.toContain('Opportunity');
  expect(html).not.toContain('Risk / watch');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test -- renderHtmlEmail
```

Expected: FAIL because the current renderer still expects `opportunity`, `risk`, and `rd_signal`.

- [ ] **Step 3: Rename the `ExecutiveBrief` type fields**

```ts
export interface ExecutiveBrief {
  productivity_upside: string;
  adoption_implementation_risk: string;
  technical_signal: string;
  suggested_action: string;
}
```

- [ ] **Step 4: Update the brief renderer labels and field access**

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
pnpm test -- renderHtmlEmail
```

Expected: PASS with the new labels rendered.

- [ ] **Step 6: Commit**

```bash
git add ai-pulse-scout/src/types/executive.ts ai-pulse-scout/src/render/renderHtmlEmail.ts ai-pulse-scout/tests/renderHtmlEmail.test.ts
git commit -m "feat: relabel executive brief for productivity focus"
```

### Task 3: Rewrite executive brief parsing and fallback wording

**Files:**
- Modify: `ai-pulse-scout/src/insights/parseExecutiveInsight.ts`
- Modify: `ai-pulse-scout/src/insights/generateExecutiveBrief.ts`
- Test: `ai-pulse-scout/tests/executiveBrief.test.ts`

- [ ] **Step 1: Write failing parser and fallback tests for the new keys**

```ts
import { describe, expect, test } from 'vitest';
import { parseExecutiveBriefResponse } from '../src/insights/parseExecutiveInsight.js';
import { generateExecutiveBrief } from '../src/insights/generateExecutiveBrief.js';
import type { NormalizedItem } from '../src/types/item.js';

describe('executive brief parsing', () => {
  test('parses productivity-oriented JSON keys', () => {
    const parsed = parseExecutiveBriefResponse(`{
      "productivity_upside": "Reduce repetitive review work.",
      "adoption_implementation_risk": "Data cleanup may slow deployment.",
      "technical_signal": "A stronger multimodal extraction pattern is visible.",
      "suggested_action": "Run a focused architecture review."
    }`);

    expect(parsed).toEqual({
      productivity_upside: 'Reduce repetitive review work.',
      adoption_implementation_risk: 'Data cleanup may slow deployment.',
      technical_signal: 'A stronger multimodal extraction pattern is visible.',
      suggested_action: 'Run a focused architecture review.',
    });
  });
});
```

```ts
test('falls back to productivity-oriented brief when no client is configured', async () => {
  const items = [
    {
      title: 'Signal A',
      item_url: 'https://example.com/a',
      source_name: 'Example',
      primary_topic: 'AI Research',
      published_at: new Date('2026-05-28T12:00:00Z'),
      content_text: 'Useful technical content',
      summary: 'Useful technical content',
      key_insight: 'Useful technical content',
      content_type: 'article',
      rawMetadata: {},
    } as NormalizedItem,
  ];

  const brief = await generateExecutiveBrief(items, { apiKey: '' });

  expect(brief?.productivity_upside).toContain('automation');
  expect(brief?.adoption_implementation_risk).toContain('rollout');
  expect(brief?.technical_signal).toContain('Useful technical content');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: FAIL because the parser still expects `opportunity`, `risk`, and `rd_signal`.

- [ ] **Step 3: Update parser field names**

```ts
export function parseExecutiveBriefResponse(raw: string): ExecutiveBrief | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const productivity_upside = asString(parsed.productivity_upside);
    const adoption_implementation_risk = asString(parsed.adoption_implementation_risk);
    const technical_signal = asString(parsed.technical_signal);
    const suggested_action = asString(parsed.suggested_action);
    if (!productivity_upside || !adoption_implementation_risk || !technical_signal || !suggested_action) {
      return null;
    }

    return {
      productivity_upside,
      adoption_implementation_risk,
      technical_signal,
      suggested_action,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rewrite fallback brief wording in `generateExecutiveBrief.ts`**

```ts
function buildFallbackBrief(items: NormalizedItem[]): ExecutiveBrief {
  const lead = items[0]!;
  const insight = lead.executive_insight?.why_it_matters ?? lead.key_insight ?? lead.summary;

  return {
    productivity_upside: `Review "${lead.title}" for workflow automation or engineering-efficiency gains.`,
    adoption_implementation_risk: 'Validate data quality, system fit, and rollout complexity before any pilot.',
    technical_signal: insight || 'No analyzed technical signal available; review the top digest items directly.',
    suggested_action: 'Assign a short technical review to the platform, AI, or engineering systems lead.',
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: PASS with the new keys and fallback wording.

- [ ] **Step 6: Commit**

```bash
git add ai-pulse-scout/src/insights/parseExecutiveInsight.ts ai-pulse-scout/src/insights/generateExecutiveBrief.ts ai-pulse-scout/tests/executiveBrief.test.ts
git commit -m "feat: refocus executive brief parsing and fallback copy"
```

### Task 4: Remove the fixed 12-item cap from executive brief context generation

**Files:**
- Modify: `ai-pulse-scout/src/insights/generateExecutiveBrief.ts`
- Test: `ai-pulse-scout/tests/executiveBrief.test.ts`

- [ ] **Step 1: Write the failing test that verifies all selected items are included in context**

```ts
import { describe, expect, test } from 'vitest';
import { __testOnly_buildBriefContext } from '../src/insights/generateExecutiveBrief.js';
import type { NormalizedItem } from '../src/types/item.js';

function makeItem(index: number): NormalizedItem {
  return {
    title: `Signal ${index}`,
    item_url: `https://example.com/${index}`,
    source_name: 'Example',
    primary_topic: 'AI Research',
    published_at: new Date('2026-05-28T12:00:00Z'),
    content_text: `Content ${index}`,
    summary: `Summary ${index}`,
    key_insight: `Insight ${index}`,
    content_type: 'article',
    rawMetadata: {},
  } as NormalizedItem;
}

describe('buildBriefContext', () => {
  test('includes every selected item instead of truncating at 12', () => {
    const items = Array.from({ length: 14 }, (_, i) => makeItem(i + 1));
    const context = __testOnly_buildBriefContext(items);

    expect(context).toContain('Signal 1');
    expect(context).toContain('Signal 12');
    expect(context).toContain('Signal 13');
    expect(context).toContain('Signal 14');
    expect(context).toContain('14 total');
    expect(context).not.toContain('showing up to 12');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: FAIL because the current implementation slices to 12 and says `showing up to 12`.

- [ ] **Step 3: Remove the hard cap and expose a test helper**

```ts
export function __testOnly_buildBriefContext(items: NormalizedItem[]): string {
  const lines = items.map((item, index) => {
    const insight = item.executive_insight?.why_it_matters ?? item.key_insight ?? item.summary;
    const tags = [
      item.executive_insight?.growth_lever,
      item.executive_insight?.action,
      item.primary_topic,
    ]
      .filter(Boolean)
      .join(' · ');
    return `${index + 1}. [${tags}] ${item.title}\n   ${insight}`;
  });

  return `Today's digest items (${items.length} total):\n\n${lines.join('\n\n')}`;
}
```

```ts
function buildBriefContext(items: NormalizedItem[]): string {
  return __testOnly_buildBriefContext(items);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: PASS with all items included.

- [ ] **Step 5: Commit**

```bash
git add ai-pulse-scout/src/insights/generateExecutiveBrief.ts ai-pulse-scout/tests/executiveBrief.test.ts
git commit -m "feat: remove fixed executive brief item cap"
```

### Task 5: Rewrite the executive-brief prompt to match the new focus

**Files:**
- Modify: `ai-pulse-scout/src/insights/generateExecutiveBrief.ts`
- Test: `ai-pulse-scout/tests/executiveBrief.test.ts`

- [ ] **Step 1: Write the failing test for the new prompt wording**

```ts
import { EXECUTIVE_BRIEF_SYSTEM_PROMPT } from '../src/insights/generateExecutiveBrief.js';

test('uses productivity and implementation oriented brief instructions', () => {
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('CIO and Chief AI Officer');
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('technical productivity');
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('implementation');
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).toContain('productivity_upside');
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).not.toContain('growth upside');
  expect(EXECUTIVE_BRIEF_SYSTEM_PROMPT).not.toContain('manufacturing growth enablement');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: FAIL because the current prompt still references growth language and old JSON keys.

- [ ] **Step 3: Replace the prompt constant and export it for test coverage**

```ts
export const EXECUTIVE_BRIEF_SYSTEM_PROMPT = `You are preparing a daily executive brief for a CIO and Chief AI Officer.
Return ONLY valid JSON with these keys:
{
  "productivity_upside": "one sentence — strongest productivity or efficiency upside from today's signals",
  "adoption_implementation_risk": "one sentence — biggest adoption, integration, or implementation risk to watch",
  "technical_signal": "one sentence — strongest technical or R&D signal from today's items",
  "suggested_action": "one sentence — concrete next step for the technical leadership team"
}
Be specific, avoid hype, focus on technical productivity, efficiency, implementation realism, and practical next actions.`;
```

- [ ] **Step 4: Use the new exported prompt in `generateExecutiveBrief()`**

```ts
const raw = await requestChatCompletion(
  client,
  [
    { role: 'system', content: EXECUTIVE_BRIEF_SYSTEM_PROMPT },
    { role: 'user', content: buildBriefContext(items) },
  ],
  600,
);
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
pnpm test -- executiveBrief
```

Expected: PASS with the new prompt text.

- [ ] **Step 6: Commit**

```bash
git add ai-pulse-scout/src/insights/generateExecutiveBrief.ts ai-pulse-scout/tests/executiveBrief.test.ts
git commit -m "feat: refocus executive brief prompt for CIO productivity"
```

### Task 6: Run targeted verification and capture the final state

**Files:**
- Modify: none (unless test fixes are required)
- Test: `ai-pulse-scout/tests/renderHtmlEmail.test.ts`
- Test: `ai-pulse-scout/tests/executiveBrief.test.ts`

- [ ] **Step 1: Run the targeted tests together**

Run:
```bash
pnpm test -- renderHtmlEmail executiveBrief
```

Expected: PASS with all updated branding, labels, parser behavior, prompt wording, and context coverage.

- [ ] **Step 2: Run a type-aware or project-level test command used by this repo**

Run:
```bash
pnpm test
```

Expected: PASS, or if the suite is large and intentionally selective, document the exact failing unrelated tests before proceeding.

- [ ] **Step 3: Inspect the rendered digest artifact with a local dry run if available**

Run:
```bash
pnpm tsx ai-pulse-scout/src/jobs/runDailyDigest.ts
```

Expected: command completes or prints the expected run logs and writes an updated HTML artifact under `ai-pulse-scout/data/output/` or the configured output directory.

- [ ] **Step 4: Commit the final integrated changes**

```bash
git add ai-pulse-scout/config/email.yaml \
  ai-pulse-scout/src/render/renderHtmlEmail.ts \
  ai-pulse-scout/src/types/executive.ts \
  ai-pulse-scout/src/insights/parseExecutiveInsight.ts \
  ai-pulse-scout/src/insights/generateExecutiveBrief.ts \
  ai-pulse-scout/tests/renderHtmlEmail.test.ts \
  ai-pulse-scout/tests/executiveBrief.test.ts
git commit -m "feat: refine AI Pulse Scout executive email framing"
```

---

## Self-review

### Spec coverage
- Restored `AI Pulse Scout` branding: covered by Task 1.
- Removed subtitle: covered by Task 1.
- Shifted brief semantics to productivity / implementation: covered by Tasks 2, 3, and 5.
- Removed fixed 12-item cap: covered by Task 4.
- Kept body/brief aligned to the same selected item set: preserved by Tasks 1–5 and verified in Task 6.

### Placeholder scan
- No `TBD`, `TODO`, or vague “handle appropriately” steps remain.
- Every code-changing step includes concrete code.
- Every verification step includes a concrete command and expected result.

### Type consistency
- `ExecutiveBrief` field names are consistently updated across renderer, parser, prompt, and fallback paths.
- `EXECUTIVE_BRIEF_SYSTEM_PROMPT` and `__testOnly_buildBriefContext` are explicitly named so tests and implementation refer to the same exported symbols.
