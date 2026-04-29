# X MCP KB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an `x-mcp-reader` skill and wire it into the existing Notion KB workflow so `KB: <x-link>` prefers X MCP retrieval, documents setup/verification, and preserves partial-content honesty.

**Architecture:** Keep retrieval and KB writing separate. Add a dedicated `x-mcp-reader` skill in the workspace for X/Twitter MCP usage guidance and diagnostic flow, then update the existing `notion-ludi` skill instructions so X links prefer the new MCP path before older fallbacks. Add concise reference docs for installation assumptions, verification, and failure diagnosis.

**Tech Stack:** OpenClaw AgentSkills (`SKILL.md`), markdown references, existing `notion-ludi` skill, git

---

## File Map

- Create: `skills/x-mcp-reader/SKILL.md` — main skill instructions for reading X links through MCP in KB scenarios
- Create: `skills/x-mcp-reader/references/setup-and-verification.md` — how to connect, verify, and diagnose the MCP dependency
- Create: `skills/x-mcp-reader/references/kb-usage-contract.md` — normalized content contract and KB-specific handling rules
- Modify: `/opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md` — insert X MCP preference into KB fetch order and fallback rules
- Modify: `USER.md` — record that KB X links should prefer X MCP when available
- Modify: `memory/2026-04-29.md` — record what was built and the agreed workflow, if the file exists or create it if needed

### Task 1: Create `x-mcp-reader` skill skeleton

**Files:**
- Create: `skills/x-mcp-reader/SKILL.md`

- [ ] **Step 1: Write the skill frontmatter and opening purpose**

```md
---
name: x-mcp-reader
description: Read X / Twitter post and thread links through an installed X MCP integration, primarily for KB ingestion and fallback-resistant content retrieval. Use when the user provides an X link, especially in `KB:` workflows, and the goal is to obtain reliable post/thread text, detect partial retrieval, and pass normalized content into a downstream knowledge-base workflow.
---

# x-mcp-reader

Use this skill when an X / Twitter URL should be read through an MCP integration rather than relying only on normal webpage fetches.
```

- [ ] **Step 2: Add the KB-oriented usage rules**

```md
For this workspace, prioritize `x-mcp-reader` for `KB:` requests whose primary source is an X / Twitter post or thread.

Default behavior:
- Treat single-post and thread reading as the first-stage responsibility of this skill.
- Do not write directly into Notion from this skill.
- Produce a normalized content package for downstream KB formatting.
- If the MCP can only provide partial content, preserve that limitation explicitly.
```

- [ ] **Step 3: Add the normalized output contract section**

```md
Normalized content package:
- `source_type`: `x-post` | `x-thread` | `x-share-link`
- `status`: `full` | `partial` | `unavailable`
- `url`
- `author`
- `published_at` when available
- `body_segments` in reading order
- `discovered_links` extracted from the content when available
- `notes` for truncation, missing replies, auth limits, or ambiguity
```

- [ ] **Step 4: Add the decision rules and failure labeling section**

```md
Decision rules:
1. If the X post mainly shares an external article and that article is the real primary source, prefer the original article for KB ingestion.
2. If the X post or thread is itself the primary source, prefer MCP retrieval before webpage-based fallbacks.
3. If MCP output is incomplete, label the result `partial` and do not imply full coverage.
4. If MCP is unavailable, label the result `unavailable` and let downstream KB logic decide whether to use fallback fetchers.
5. If fallback content conflicts with MCP content, trust MCP as the primary source of truth for the X text.
```

- [ ] **Step 5: Commit**

```bash
git add skills/x-mcp-reader/SKILL.md
git commit -m "Add x-mcp-reader skill"
```

### Task 2: Add setup and verification reference

**Files:**
- Create: `skills/x-mcp-reader/references/setup-and-verification.md`

- [ ] **Step 1: Write the setup expectations section**

```md
# Setup and Verification

## Expected environment

This skill assumes an X-capable MCP server exists and is already installable in the local environment or OpenClaw host environment.

This skill does not assume:
- automatic dependency discovery
- automatic installation of unknown third-party MCP servers
- automatic repair of external MCP auth or quota issues
```

- [ ] **Step 2: Write the verification checklist**

```md
## Verification checklist

Before using this skill in a KB flow, verify:
1. The MCP server is configured in the environment where the agent runs.
2. The MCP integration exposes a tool or resource capable of reading an X post or thread.
3. A public sample X URL returns actual body content rather than a shell summary.
4. The returned content includes enough structure to distinguish single posts, threads, and partial retrieval.
```

- [ ] **Step 3: Write the failure diagnosis section**

```md
## Failure diagnosis

Common failure categories:
- MCP server missing
- MCP server installed but not connected to the runtime
- auth or entitlement failure
- response contains only metadata or summary, not body text
- thread expansion incomplete
- returned links are present but the core post text is absent

When diagnosing, record which category occurred before falling back to older fetch paths.
```

- [ ] **Step 4: Commit**

```bash
git add skills/x-mcp-reader/references/setup-and-verification.md
git commit -m "Add X MCP setup and verification reference"
```

### Task 3: Add KB usage contract reference

**Files:**
- Create: `skills/x-mcp-reader/references/kb-usage-contract.md`

- [ ] **Step 1: Write the KB handoff contract**

```md
# KB Usage Contract

## Handoff to KB workflow

The downstream KB workflow should receive a normalized package with:
- source classification
- retrieval completeness status
- ordered text segments
- extracted outbound links
- notes about missing context or partial thread coverage
```

- [ ] **Step 2: Write the KB formatting expectations**

```md
## KB formatting expectations

When the downstream workflow writes an X-derived page into Notion:
- keep the compact Chinese overview at the top
- do not place the raw source URL as the first line of body content
- if the source language is non-Chinese, preserve English + Chinese bilingual structure
- keep English and Chinese text in two distinct colors
- explicitly mark partial retrieval before the main body when the source is incomplete
```

- [ ] **Step 3: Write the source interpretation rules**

```md
## Source interpretation rules

- `x-post`: treat the post text as the primary body
- `x-thread`: treat the available ordered thread text as the primary body
- `x-share-link`: if the shared external article is accessible and more authoritative, route KB ingestion toward the article itself and treat the X post as context
```

- [ ] **Step 4: Commit**

```bash
git add skills/x-mcp-reader/references/kb-usage-contract.md
git commit -m "Add X MCP KB usage contract reference"
```

### Task 4: Update `notion-ludi` KB fetch order for X links

**Files:**
- Modify: `/opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md`

- [ ] **Step 1: Add X MCP to the KB X-link priority path**

```md
For `KB:` links from X / Twitter, prefer this fetch order:
1. If the post is mainly sharing an external article, locate and use the original public article when that article is the real primary source.
2. If the X post or thread itself is the source, prefer `x-mcp-reader` / X MCP retrieval first.
3. If X MCP is unavailable or returns only partial structure, use existing fallbacks such as xcrawl, browser-backed fetching, or source discovery.
4. If the final saved result is partial, state that explicitly in the KB body rather than implying complete coverage.
```

- [ ] **Step 2: Add the normalized-result expectation**

```md
When `x-mcp-reader` is used, treat its normalized content package as the primary source of truth for X body text. Do not merge contradictory fallback text into the saved body. Use fallback paths only to recover missing context, confirm discovered outbound links, or obtain the original article when the X post is mainly a share wrapper.
```

- [ ] **Step 3: Commit**

```bash
git add /opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md
git commit -m "Prioritize X MCP for KB X links"
```

### Task 5: Record workspace preference and implementation note

**Files:**
- Modify: `USER.md`
- Modify: `memory/2026-04-29.md`

- [ ] **Step 1: Add the user preference note**

```md
- For `KB:` requests using X / Twitter links, prefer X MCP retrieval when available before older fallback fetch methods.
```

- [ ] **Step 2: Add the daily memory note**

```md
## X MCP KB integration
- Wrote and approved an implementation plan for adding an `x-mcp-reader` skill.
- Agreed that KB ingestion for X links should prefer X MCP first, then fall back if unavailable.
- Preserved the rule that partial X retrieval must be labeled honestly in Notion KB pages.
```

- [ ] **Step 3: Commit**

```bash
git add USER.md memory/2026-04-29.md
git commit -m "Record X MCP KB workflow preference"
```

### Task 6: Verify the documentation set

**Files:**
- Test by reading: `skills/x-mcp-reader/SKILL.md`
- Test by reading: `skills/x-mcp-reader/references/setup-and-verification.md`
- Test by reading: `skills/x-mcp-reader/references/kb-usage-contract.md`
- Test by reading: `/opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md`
- Test by reading: `USER.md`

- [ ] **Step 1: Verify the new skill files exist and are readable**

Run:
```bash
test -f skills/x-mcp-reader/SKILL.md && test -f skills/x-mcp-reader/references/setup-and-verification.md && test -f skills/x-mcp-reader/references/kb-usage-contract.md && echo OK
```
Expected: `OK`

- [ ] **Step 2: Verify `notion-ludi` mentions X MCP priority**

Run:
```bash
grep -n "x-mcp-reader\|X MCP" /opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md
```
Expected: one or more matching lines that show X MCP / `x-mcp-reader` is part of the X-link KB fetch order

- [ ] **Step 3: Verify workspace notes capture the preference**

Run:
```bash
grep -n "X MCP" USER.md memory/2026-04-29.md
```
Expected: matching lines in both files

- [ ] **Step 4: Commit final verification state**

```bash
git add skills/x-mcp-reader USER.md memory/2026-04-29.md docs/superpowers/plans/2026-04-29-x-mcp-kb-implementation.md
git commit -m "Finalize X MCP KB integration docs"
```

## Self-Review

- Spec coverage check: the plan covers the new skill, the Notion KB wiring change, setup/verification docs, partial-content labeling, and workspace preference capture.
- Placeholder scan: no TODO or TBD placeholders remain.
- Consistency check: the same normalized package fields and X MCP priority rules are used throughout the plan.
