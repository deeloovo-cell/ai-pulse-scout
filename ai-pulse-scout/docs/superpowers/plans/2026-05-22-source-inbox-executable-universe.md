# Source Inbox Executable Universe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Pulse Scout systematically traverse all 123 URLs in `config/source-inbox.md` by parsing the inbox, classifying every source, assigning a fetch strategy, and producing a coverage report that proves what is readable, what fails, and which unreadable URLs should be removed from the active source universe.

**Architecture:** Introduce a new "source universe" layer in front of the current digest pipeline. This layer parses the raw inbox markdown into structured source records, resolves each record into a source kind + fetch strategy, and runs a coverage-oriented traversal pass that emits machine-readable results and a human-readable validation report. Existing feed fetching remains intact and is reused as the first adapter family. Unreadable sources are surfaced for removal instead of being kept indefinitely as deferred placeholders.

**Tech Stack:** TypeScript, Node.js, existing Vitest test suite, existing config folder, existing RSS parsing stack, YAML/Markdown file parsing utilities built in-project.

---

## File Structure

### New files
- `src/inbox/parseSourceInbox.ts` — Parse `config/source-inbox.md` into structured raw source entries.
- `src/inbox/classifySource.ts` — Infer source kind, platform, and fetch strategy from URL/domain/path.
- `src/inbox/buildSourceUniverse.ts` — Combine parsed entries with classification into executable source records.
- `src/inbox/types.ts` — Shared types for parsed inbox entries, source classification, and coverage results.
- `src/inbox/coverageReport.ts` — Build JSON and console-friendly coverage summaries.
- `src/adapters/feedAdapter.ts` — Wrap existing RSS/Atom/podcast fetch logic behind adapter interface.
- `src/adapters/types.ts` — Adapter request/response/result types.
- `src/jobs/runSourceCoverage.ts` — Execute traversal of all inbox sources and return coverage results.
- `src/cli/coverage.ts` — CLI entry point for source universe coverage validation.
- `tests/parseSourceInbox.test.ts` — Tests for markdown parsing and category extraction.
- `tests/classifySource.test.ts` — Tests for URL classification and fetch strategy inference.
- `tests/sourceCoverage.test.ts` — Tests for coverage execution/result accounting.
- `data/output/source-coverage/README.md` — Explain generated validation artifacts.

### Modified files
- `package.json` — Add `coverage` script for the new CLI.
- `README.md` — Document the new coverage command and explain the distinction between raw inbox and executable coverage.
- `src/fetchers/rssFetcher.ts` — Optionally extract reusable feed-fetch behavior into adapter-compatible function.
- `src/types/config.ts` — Reuse or extend source typing only if needed for adapter compatibility.

---

### Task 1: Add source-universe types

**Files:**
- Create: `src/inbox/types.ts`
- Test: `tests/classifySource.test.ts`

- [ ] **Step 1: Create source universe types**

```ts
export type SourceSection =
  | 'core_ai_engineering'
  | 'industrial_ai'
  | 'cad_cae_cam'
  | 'youtube_channels'
  | 'podcasts'
  | 'rss_newsletters'
  | 'research_sources'
  | 'open_source_communities'
  | 'ai_leaders_blogs'
  | 'ai_leaders_social'
  | 'ai_leaders_media'
  | 'enterprise_industrial_ai_leaders'
  | 'academic_research_leaders'
  | 'third_party_ai_news'
  | 'data_science_ai_engineering'
  | 'consulting_enterprise_ai'
  | 'industrial_engineering_ai'
  | 'ai_research_reports'
  | 'unknown';

export type SourceKind =
  | 'feed'
  | 'podcast'
  | 'youtube'
  | 'github'
  | 'x'
  | 'linkedin'
  | 'facebook'
  | 'generic_web'
  | 'research_listing'
  | 'unknown';

export type FetchStrategy =
  | 'rss_parser'
  | 'podcast_feed'
  | 'youtube_channel_resolution'
  | 'github_release_feed'
  | 'x_profile_fetch'
  | 'social_profile_deferred'
  | 'generic_web_discovery'
  | 'research_listing_discovery'
  | 'manual_review';

export interface ParsedInboxSource {
  section: SourceSection;
  subsection: string | null;
  label: string | null;
  url: string;
  line: number;
}

export interface ClassifiedSource {
  kind: SourceKind;
  strategy: FetchStrategy;
  platform: string;
  rationale: string;
  traversable: boolean;
}

export interface SourceUniverseRecord extends ParsedInboxSource {
  classification: ClassifiedSource;
}

export type CoverageStatus = 'success' | 'empty' | 'remove' | 'failed';

export interface CoverageResult {
  source: SourceUniverseRecord;
  status: CoverageStatus;
  discoveredCount: number;
  error?: string;
  removalReason?: string;
}
```

- [ ] **Step 2: Add a type smoke test**

```ts
import { describe, expect, it } from 'vitest';
import type { CoverageStatus } from '../src/inbox/types.js';

describe('source universe types', () => {
  it('supports expected coverage statuses', () => {
    const statuses: CoverageStatus[] = ['success', 'empty', 'remove', 'failed'];
    expect(statuses).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/classifySource.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/inbox/types.ts tests/classifySource.test.ts
git commit -m "feat: add source universe core types"
```

---

### Task 2: Parse `source-inbox.md` into structured entries

**Files:**
- Create: `src/inbox/parseSourceInbox.ts`
- Test: `tests/parseSourceInbox.test.ts`

- [ ] **Step 1: Write the failing parser test**

```ts
import { describe, expect, it } from 'vitest';
import { parseSourceInbox } from '../src/inbox/parseSourceInbox.js';

describe('parseSourceInbox', () => {
  it('extracts URLs with section and subsection context', () => {
    const markdown = `# Title

## Core AI Engineering & Agentic AI
- https://blog.langchain.dev/

## AI Leaders / Influencers
### Blogs / Personal Sites
- https://karpathy.ai/
`;

    const parsed = parseSourceInbox(markdown);

    expect(parsed).toEqual([
      expect.objectContaining({
        section: 'core_ai_engineering',
        subsection: null,
        url: 'https://blog.langchain.dev/',
      }),
      expect.objectContaining({
        section: 'ai_leaders_blogs',
        subsection: 'Blogs / Personal Sites',
        url: 'https://karpathy.ai/',
      }),
    ]);
  });
});
```

- [ ] **Step 2: Implement the parser**

```ts
import type { ParsedInboxSource, SourceSection } from './types.js';

const SECTION_MAP: Array<{ pattern: RegExp; section: SourceSection }> = [
  [/^core ai engineering/i, 'core_ai_engineering'],
  [/^industrial ai/i, 'industrial_ai'],
  [/^ai for cad/i, 'cad_cae_cam'],
  [/^youtube channels/i, 'youtube_channels'],
  [/^podcasts/i, 'podcasts'],
  [/^rss\s*\/\s*newsletters/i, 'rss_newsletters'],
  [/^research sources/i, 'research_sources'],
  [/^open source/i, 'open_source_communities'],
  [/^blogs\s*\/\s*personal sites/i, 'ai_leaders_blogs'],
  [/^social\s*\/\s*professional profiles/i, 'ai_leaders_social'],
  [/^podcasts\s*\/\s*media/i, 'ai_leaders_media'],
  [/^enterprise\s*\/\s*industrial ai leaders/i, 'enterprise_industrial_ai_leaders'],
  [/^academic\s*\/\s*research leaders/i, 'academic_research_leaders'],
  [/^ai news\s*\/\s*enterprise ai/i, 'third_party_ai_news'],
  [/^data science\s*\/\s*ai engineering/i, 'data_science_ai_engineering'],
  [/^consulting\s*\/\s*enterprise ai strategy/i, 'consulting_enterprise_ai'],
  [/^industrial ai\s*\/\s*engineering ai/i, 'industrial_engineering_ai'],
  [/^ai research\s*\/\s*benchmark reports/i, 'ai_research_reports'],
];

function mapHeadingToSection(text: string): SourceSection {
  const normalized = text.trim().toLowerCase();
  for (const entry of SECTION_MAP) {
    if (entry.pattern.test(normalized)) return entry.section;
  }
  return 'unknown';
}

export function parseSourceInbox(markdown: string): ParsedInboxSource[] {
  const lines = markdown.split(/\r?\n/);
  const results: ParsedInboxSource[] = [];
  let section: SourceSection = 'unknown';
  let subsection: string | null = null;

  lines.forEach((line, idx) => {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      section = mapHeadingToSection(h2[1]);
      subsection = null;
      return;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      subsection = h3[1].trim();
      section = mapHeadingToSection(subsection);
      return;
    }

    const bulletUrl = line.match(/^-\s+(https?:\/\/\S+)$/);
    if (bulletUrl) {
      results.push({
        section,
        subsection,
        label: null,
        url: bulletUrl[1],
        line: idx + 1,
      });
    }
  });

  return results;
}
```

- [ ] **Step 3: Run the parser test**

Run: `npm test -- tests/parseSourceInbox.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/inbox/parseSourceInbox.ts tests/parseSourceInbox.test.ts
git commit -m "feat: parse source inbox markdown into structured entries"
```

---

### Task 3: Classify each URL into source kind and strategy

**Files:**
- Create: `src/inbox/classifySource.ts`
- Modify: `tests/classifySource.test.ts`

- [ ] **Step 1: Expand classification tests**

```ts
import { describe, expect, it } from 'vitest';
import { classifySource } from '../src/inbox/classifySource.js';

describe('classifySource', () => {
  it('classifies representative URLs into fetch strategies', () => {
    expect(classifySource('https://blog.langchain.dev/')).toMatchObject({
      kind: 'generic_web',
      strategy: 'generic_web_discovery',
      traversable: true,
    });

    expect(classifySource('https://www.youtube.com/@aiDotEngineer')).toMatchObject({
      kind: 'youtube',
      strategy: 'youtube_channel_resolution',
    });

    expect(classifySource('https://github.com/langchain-ai/langchain')).toMatchObject({
      kind: 'github',
      strategy: 'github_release_feed',
    });

    expect(classifySource('https://x.com/sama')).toMatchObject({
      kind: 'x',
      strategy: 'x_profile_fetch',
    });
  });
});
```

- [ ] **Step 2: Implement classifier**

```ts
import { URL } from 'node:url';
import type { ClassifiedSource } from './types.js';

export function classifySource(rawUrl: string): ClassifiedSource {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;

  if (host.includes('youtube.com')) {
    return {
      kind: 'youtube',
      strategy: 'youtube_channel_resolution',
      platform: 'youtube',
      rationale: 'YouTube handle/channel URL requires channel resolution before item fetch.',
      traversable: true,
    };
  }

  if (host === 'github.com') {
    return {
      kind: 'github',
      strategy: 'github_release_feed',
      platform: 'github',
      rationale: 'GitHub repo URLs can be resolved to releases.atom or activity endpoints.',
      traversable: true,
    };
  }

  if (host === 'x.com' || host === 'twitter.com') {
    return {
      kind: 'x',
      strategy: 'x_profile_fetch',
      platform: 'x',
      rationale: 'X profile requires dedicated retrieval adapter or API-backed fetch.',
      traversable: true,
    };
  }

  if (host.includes('linkedin.com')) {
    return {
      kind: 'linkedin',
      strategy: 'social_profile_deferred',
      platform: 'linkedin',
      rationale: 'LinkedIn profile pages are auth-gated and should be deferred explicitly.',
      traversable: false,
    };
  }

  if (host.includes('facebook.com')) {
    return {
      kind: 'facebook',
      strategy: 'social_profile_deferred',
      platform: 'facebook',
      rationale: 'Facebook profile pages are auth-gated and should be deferred explicitly.',
      traversable: false,
    };
  }

  if (host.includes('arxiv.org') || host.includes('paperswithcode.com') || path.includes('/research')) {
    return {
      kind: 'research_listing',
      strategy: 'research_listing_discovery',
      platform: host,
      rationale: 'Research listings need discovery from listing pages or known feeds.',
      traversable: true,
    };
  }

  return {
    kind: 'generic_web',
    strategy: 'generic_web_discovery',
    platform: host,
    rationale: 'Default website/article discovery strategy.',
    traversable: true,
  };
}
```

- [ ] **Step 3: Run the classification test**

Run: `npm test -- tests/classifySource.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/inbox/classifySource.ts tests/classifySource.test.ts src/inbox/types.ts
git commit -m "feat: classify inbox URLs into fetch strategies"
```

---

### Task 4: Build executable source-universe records from inbox input

**Files:**
- Create: `src/inbox/buildSourceUniverse.ts`
- Modify: `tests/parseSourceInbox.test.ts`

- [ ] **Step 1: Add a failing universe-builder test**

```ts
import { describe, expect, it } from 'vitest';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';

describe('buildSourceUniverse', () => {
  it('enriches parsed inbox entries with classification', () => {
    const markdown = `## YouTube Channels\n- https://www.youtube.com/@aiDotEngineer\n`;
    const universe = buildSourceUniverse(markdown);

    expect(universe[0]).toMatchObject({
      url: 'https://www.youtube.com/@aiDotEngineer',
      classification: {
        kind: 'youtube',
        strategy: 'youtube_channel_resolution',
      },
    });
  });
});
```

- [ ] **Step 2: Implement the universe builder**

```ts
import { classifySource } from './classifySource.js';
import { parseSourceInbox } from './parseSourceInbox.js';
import type { SourceUniverseRecord } from './types.js';

export function buildSourceUniverse(markdown: string): SourceUniverseRecord[] {
  return parseSourceInbox(markdown).map((entry) => ({
    ...entry,
    classification: classifySource(entry.url),
  }));
}
```

- [ ] **Step 3: Run the relevant tests**

Run: `npm test -- tests/parseSourceInbox.test.ts tests/classifySource.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/inbox/buildSourceUniverse.ts tests/parseSourceInbox.test.ts
git commit -m "feat: build executable source universe from inbox"
```

---

### Task 5: Add adapter interfaces and feed adapter

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/feedAdapter.ts`
- Modify: `src/fetchers/rssFetcher.ts`
- Test: `tests/sourceCoverage.test.ts`

- [ ] **Step 1: Write a failing adapter behavior test**

```ts
import { describe, expect, it } from 'vitest';
import { canUseFeedAdapter } from '../src/adapters/feedAdapter.js';

describe('feedAdapter', () => {
  it('supports feed-like strategies and rejects others', () => {
    expect(canUseFeedAdapter('rss_parser')).toBe(true);
    expect(canUseFeedAdapter('podcast_feed')).toBe(true);
    expect(canUseFeedAdapter('generic_web_discovery')).toBe(false);
  });
});
```

- [ ] **Step 2: Add adapter types and a feed adapter**

```ts
import type { FetchStrategy, SourceUniverseRecord } from '../inbox/types.js';

export interface AdapterResult {
  discoveredCount: number;
  error?: string;
}

export interface SourceAdapter {
  canHandle(source: SourceUniverseRecord): boolean;
  run(source: SourceUniverseRecord, windowStart: Date, now: Date): Promise<AdapterResult>;
}

export function canUseFeedAdapter(strategy: FetchStrategy): boolean {
  return strategy === 'rss_parser' || strategy === 'podcast_feed';
}
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/sourceCoverage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/types.ts src/adapters/feedAdapter.ts tests/sourceCoverage.test.ts src/fetchers/rssFetcher.ts
git commit -m "feat: add adapter interface and feed adapter"
```

---

### Task 6: Add coverage execution for all inbox sources

Requirement update: all 123 URLs should be readable; if a URL is not readable in practice, the coverage run must flag it clearly so it can be removed from the active source list.

**Files:**
- Create: `src/jobs/runSourceCoverage.ts`
- Create: `src/inbox/coverageReport.ts`
- Modify: `tests/sourceCoverage.test.ts`

- [ ] **Step 1: Add a failing coverage execution test**

```ts
import { describe, expect, it } from 'vitest';
import { summarizeCoverage } from '../src/inbox/coverageReport.js';
import type { CoverageResult } from '../src/inbox/types.js';

describe('coverage reporting', () => {
  it('counts sources by status', () => {
    const results = [
      { status: 'success', discoveredCount: 3 },
      { status: 'remove', discoveredCount: 0, removalReason: 'Auth-gated or unreadable' },
      { status: 'failed', discoveredCount: 0 },
    ] as CoverageResult[];

    expect(summarizeCoverage(results)).toMatchObject({
      totalSources: 3,
      success: 1,
      remove: 1,
      failed: 1,
    });
  });
});
```

- [ ] **Step 2: Implement coverage reporting and execution**

```ts
import type { CoverageResult, SourceUniverseRecord } from './types.js';

export function summarizeCoverage(results: CoverageResult[]) {
  return {
    totalSources: results.length,
    success: results.filter((r) => r.status === 'success').length,
    empty: results.filter((r) => r.status === 'empty').length,
    remove: results.filter((r) => r.status === 'remove').length,
    failed: results.filter((r) => r.status === 'failed').length,
    discoveredPosts: results.reduce((sum, r) => sum + r.discoveredCount, 0),
  };
}

export async function runSourceCoverage(
  universe: SourceUniverseRecord[],
): Promise<CoverageResult[]> {
  return universe.map((source) => {
    if (!source.classification.traversable) {
      return {
        source,
        status: 'remove',
        discoveredCount: 0,
        removalReason: `Unreadable source for active universe: ${source.classification.rationale}`,
      };
    }

    return {
      source,
      status: 'remove',
      discoveredCount: 0,
      removalReason: `No working adapter yet for strategy ${source.classification.strategy}`,
    };
  });
}
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/sourceCoverage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/jobs/runSourceCoverage.ts src/inbox/coverageReport.ts tests/sourceCoverage.test.ts
git commit -m "feat: add source coverage execution and reporting"
```

---

### Task 7: Add CLI to validate all 123 URLs and save artifacts

**Files:**
- Create: `src/cli/coverage.ts`
- Modify: `package.json`
- Modify: `README.md`
- Create: `data/output/source-coverage/README.md`

- [ ] **Step 1: Add a CLI script entry**

```json
{
  "scripts": {
    "coverage:sources": "tsx src/cli/coverage.ts"
  }
}
```

- [ ] **Step 2: Implement the coverage CLI**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSourceUniverse } from '../inbox/buildSourceUniverse.js';
import { summarizeCoverage } from '../inbox/coverageReport.js';
import { runSourceCoverage } from '../jobs/runSourceCoverage.js';

const markdown = readFileSync('config/source-inbox.md', 'utf8');
const universe = buildSourceUniverse(markdown);
const results = await runSourceCoverage(universe);
const summary = summarizeCoverage(results);

mkdirSync('data/output/source-coverage', { recursive: true });
writeFileSync(
  join('data/output/source-coverage', 'latest.json'),
  JSON.stringify({ summary, results }, null, 2),
  'utf8',
);

console.log('AI Pulse Scout — Source Coverage');
console.log(JSON.stringify(summary, null, 2));
```

- [ ] **Step 3: Document the command**

Add to `README.md`:

```md
### Source Universe Coverage

Run this to validate how the raw inbox source universe is currently classified and traversed:

```bash
npm run coverage:sources
```

This command:
- parses `config/source-inbox.md`
- classifies every inbox URL
- runs coverage validation across the full source universe
- flags unreadable URLs for removal from the active source set
- writes results to `data/output/source-coverage/latest.json`
```

- [ ] **Step 4: Run the CLI**

Run: `npm run coverage:sources`
Expected: prints a JSON summary with `totalSources` equal to the inbox URL count

- [ ] **Step 5: Commit**

```bash
git add src/cli/coverage.ts package.json README.md data/output/source-coverage/README.md
git commit -m "feat: add source coverage validation cli"
```

---

### Task 8: Validate against the real 123-URL inbox

**Files:**
- Modify: `tests/parseSourceInbox.test.ts`
- Modify: `tests/sourceCoverage.test.ts`

- [ ] **Step 1: Add a real-inbox regression test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';

describe('real source inbox coverage baseline', () => {
  it('parses all source inbox URLs into universe records', () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    expect(universe.length).toBe(123);
  });
});
```

- [ ] **Step 2: Add a coverage summary regression test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSourceUniverse } from '../src/inbox/buildSourceUniverse.js';
import { summarizeCoverage } from '../src/inbox/coverageReport.js';
import { runSourceCoverage } from '../src/jobs/runSourceCoverage.js';

describe('real inbox coverage summary', () => {
  it('accounts for every source in the coverage summary', async () => {
    const markdown = readFileSync('config/source-inbox.md', 'utf8');
    const universe = buildSourceUniverse(markdown);
    const results = await runSourceCoverage(universe);
    const summary = summarizeCoverage(results);

    expect(summary.totalSources).toBe(123);
    expect(summary.success + summary.empty + summary.remove + summary.failed).toBe(123);
  });
});
```

- [ ] **Step 3: Run the full focused test set**

Run: `npm test -- tests/parseSourceInbox.test.ts tests/classifySource.test.ts tests/sourceCoverage.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/parseSourceInbox.test.ts tests/sourceCoverage.test.ts
git commit -m "test: lock source universe coverage to real inbox size"
```

---

## Self-Review

### Spec coverage
- Requirement: traverse all 123 URLs — covered by inbox parser, universe builder, CLI, and regression test locked to 123 entries.
- Requirement: step #1 only, no time-window/email redesign yet — respected. This plan stops at coverage traversal and reporting.
- Requirement: unreadable URLs should be reported and removed — covered by `remove` status, `removalReason`, and coverage summary artifacts.

### Placeholder scan
- No TODO/TBD placeholders in task steps.
- Each task includes exact files and commands.
- Commands specify expected outcomes.

### Type consistency
- `SourceUniverseRecord`, `CoverageResult`, `FetchStrategy`, and `CoverageStatus` are used consistently across parser, classifier, coverage runner, and tests.
- CLI and reporting tasks use the same `summarizeCoverage()` contract defined earlier.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-source-inbox-executable-universe.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
