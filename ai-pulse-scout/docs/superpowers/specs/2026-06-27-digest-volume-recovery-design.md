# AI Pulse Scout: digest volume recovery design

Date: 2026-06-27
Branch: feature/ai-pulse-scout-mvp
Status: approved-in-chat (approach B)

## Decision

Adopt a pragmatic volume-recovery pass for the AI Pulse Scout daily static digest.

This pass should increase the number of viable daily digest items while preserving the current overall architecture and keeping the post-enrichment LLM relevance gate in place.

## Goals

1. Recover daily digest volume by removing clearly dead RSS feeds from the active source registry.
2. Increase the upstream candidate pool by relaxing the current per-source and per-source-family caps.
3. Preserve a quality floor by keeping the existing LLM relevance gate that drops items rated `Low`.
4. Improve observability so future low-volume days can be explained from command output instead of log forensics.
5. Fix the current source-coverage command so it reports trustworthy counts.

## Non-goals

1. Re-architecting the ingestion pipeline.
2. Replacing all blocked, malformed, or timeout-prone feeds in this pass.
3. Removing the LLM relevance gate.
4. Guaranteeing exactly 100 final items every day regardless of source activity.
5. Solving launchd permission problems in the same change set.

## Problem summary

Current low daily volume is caused by multiple layers compounding together:

1. The source registry still contains a significant set of clearly dead feeds (especially 404/410 responses), reducing the effective candidate pool before any filtering.
2. Unified ingestion caps each source to 10 items.
3. Final digest capping limits each source family to 10 items, with all arXiv-derived entries grouped into the single `arxiv` family.
4. The static-site export path drops items rated `Low` by the LLM relevance gate.
5. The `coverage:sources` command currently reports counts that conflict with `validate-sources`, so operators do not have a trustworthy summary view.

## Chosen approach

Approach B: targeted source cleanup + cap expansion + diagnostics hardening.

### Part 1: Source cleanup

Update `config/sources.yaml` to disable or remove only feeds that are clearly dead based on strong evidence from validation:

- HTTP 404
- HTTP 410

These are treated as deterministic failures rather than transient network or parser issues.

Feeds failing with 401/403, timeouts, malformed XML, or environment-dependent connection problems should remain in the registry for now, but diagnostics should make them visible.

### Part 2: Cap expansion

Increase the volume caps conservatively but materially:

- Per-source ingestion cap: 10 → 20
- Default source-family cap: 10 → 20
- arXiv source-family cap: 10 → 40

Rationale:
- 20 per source gives high-output feeds more room without allowing one source to dominate completely.
- 20 per family preserves some diversity control.
- arXiv gets a separate higher cap because the current single-family treatment suppresses a large portion of the research pipeline.

### Part 3: Keep LLM relevance gate unchanged

The `Low`-drop gate remains active in this pass.

Rationale:
- This change set already broadens the upstream pool substantially.
- Removing the gate at the same time would make it harder to attribute any final volume or quality shift.
- If volume remains too low after this pass, relevance gating can be evaluated separately with cleaner evidence.

### Part 4: Diagnostics hardening

Strengthen `validate-sources` and `coverage:sources` so they expose:

1. enabled source count
2. OK / empty / failed source counts
3. failure reason buckets
4. total discovered items in the inspection window
5. any mismatch between configured sources and inspected sources

The commands do not need to become full observability tooling; they only need to produce trustworthy operator-facing summaries.

## Data / behavior changes

### Source registry behavior

The active registry should shrink slightly by removing only confidently dead feeds. This reduces noise and improves the ratio of live sources to configured sources.

### Ingestion behavior

Each source may contribute up to 20 items into the unified candidate pool rather than 10.

### Final digest behavior

The selected digest may include up to 20 items from most source families, and up to 40 items from the `arxiv` family, subject to ordering, dedupe, and LLM relevance gating.

### Diagnostic behavior

Operators should be able to run validation commands and immediately see whether a low-volume day is caused primarily by:
- dead feeds
- empty-but-healthy feeds
- cap pressure
- post-enrichment relevance dropping

## Risks

1. Increasing caps may reduce source diversity slightly on busy days.
2. arXiv may become much more prominent in the final digest.
3. Some currently failing 403/timeout/XML feeds may still depress volume until a later pass fixes or replaces them.
4. Source cleanup based only on one validation run could remove a feed that changed temporarily, though 404/410 risk is low.

## Mitigations

1. Restrict source cleanup to deterministic dead-feed statuses (404/410).
2. Keep family caps in place rather than removing them entirely.
3. Keep the LLM relevance gate unchanged for this pass.
4. Add focused tests around cap behavior and diagnostic summaries.

## Acceptance criteria

1. `config/sources.yaml` no longer includes the clearly dead 404/410 feeds chosen in this pass.
2. Unified ingestion per-source cap is increased from 10 to 20.
3. Final digest family cap is increased from 10 to 20 for normal families and to 40 for `arxiv`.
4. `coverage:sources` produces trustworthy counts instead of the current contradictory empty-only summary.
5. Validation/coverage output exposes enough information to explain low-volume days without manual log trawling.
6. Relevant targeted tests pass.
7. Changes are committed on `feature/ai-pulse-scout-mvp`.
