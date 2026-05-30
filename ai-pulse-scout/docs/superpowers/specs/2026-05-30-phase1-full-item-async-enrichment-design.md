# AI Pulse Scout Phase 1 Full-Item Async Enrichment Design

Date: 2026-05-30  
Branch: `feature/ai-pulse-scout-mvp`

## Summary

This design defines Phase 1 of the next AI Pulse Scout evolution: move from a single long-running synchronous digest job to a persisted run-based pipeline that can process all discovered items, perform required LLM enrichment for every item, and publish only after the full run reaches a terminal state.

The key constraint is not “allow partial publishing.” The key constraint is the opposite: every discovered item in the run must be processed before publication. The system therefore needs to eliminate timeout risk by changing the execution model rather than by merely increasing one global timeout.

The chosen approach is a medium-scope architectural upgrade that keeps the current Node/TypeScript and script-driven structure, while adding SQLite persistence, explicit run/item state tracking, and asynchronous worker stages for content fetch and enrichment.

## Goals

- Ensure every discovered item enters the processing pipeline for the run.
- Ensure every item receives required LLM enrichment coverage in Phase 1.
- Eliminate dependence on one monolithic synchronous job that must finish end-to-end before timing out.
- Publish only when the run is complete.
- Preserve the current repository’s script-first operational model rather than introducing external infrastructure.
- Create a durable foundation for later web publishing and human feedback loops.

## Non-Goals

- Do not implement the web publishing UI in this phase.
- Do not implement per-item human feedback capture in this phase.
- Do not move to Redis, Postgres, or a distributed queue.
- Do not fully service-ize the project into long-running daemons as the primary architecture.
- Do not redesign source selection or relevance-learning logic yet, beyond preserving fields needed by later phases.

## Constraints Confirmed

- Scope is limited to Phase 1.
- All discovered items in a run must be processed.
- Publication happens only after the entire run is complete.
- The publish schedule is window-based rather than pinned to one exact minute.
- Engineering change scope should be medium-sized: larger than a tactical patch, smaller than a full rewrite.

## Problem Statement

The current system is vulnerable because too much work is coupled into one synchronous digest path:

1. ingest sources,
2. fetch/clean item content,
3. call LLM enrichment,
4. render output,
5. send/publish,
6. finish before a single overall timeout.

As source coverage and per-item enrichment expand, this design becomes increasingly fragile. One slow fetcher, one slow LLM batch, or one larger-than-usual day can cause the entire run to exceed time limits. Increasing the timeout only postpones the failure mode.

The system must instead:

- persist the run,
- persist every item,
- persist processing progress,
- allow asynchronous worker progress inside the publish window,
- and gate publication on run completion rather than on one process staying alive for the entire duration.

## Options Considered

### Option A: File-backed batch queue

Use JSON/JSONL files and batch directories to persist pending/done/failed work while keeping the existing scripts mostly intact.

**Pros**
- Lowest code churn.
- Fastest short-term patch.

**Cons**
- State bookkeeping becomes fragile quickly.
- Harder to coordinate retries, visibility, locking, and later UI integration.
- Poor long-term fit for Phase 2.

### Option B: SQLite + run/item state machine + async workers (**chosen**)

Keep the current Node/TypeScript script structure, but add SQLite persistence, explicit run and item state, and separate worker stages for content fetch and enrichment.

**Pros**
- Solves the actual timeout problem.
- Preserves local simplicity.
- Enables retries, progress tracking, and deterministic publish gating.
- Naturally supports later website and feedback work.

**Cons**
- More moving parts than the current script-only flow.
- Requires schema design, state-machine discipline, and worker coordination.

### Option C: Service-oriented pipeline

Split ingestion, enrichment, and publication into more explicit services and adopt a heavier operational model.

**Pros**
- Best long-term scaling path.
- Natural fit for a fuller product platform.

**Cons**
- Too heavy for the current project stage.
- Higher implementation and maintenance cost now than justified.

## Chosen Design

AI Pulse Scout Phase 1 will adopt:

- SQLite persistence,
- a run/item state machine,
- asynchronous fetch and enrichment workers,
- and publish gating that requires the run to reach full terminal-state completion before publication.

This is intentionally a pipeline redesign, not merely a timeout increase.

## Architecture Overview

The system is split into four operational stages:

1. **Collect**
2. **Fetch Content**
3. **LLM Enrichment**
4. **Publish**

The stages remain script-driven, but their coordination happens through persisted run and item state in SQLite.

### Stage 1: Collect

Responsibilities:
- read configured sources,
- collect candidate items,
- normalize core metadata,
- dedupe items for the run,
- persist the run record,
- persist item records,
- mark items ready for downstream processing.

This stage is responsible for establishing the run ledger. After it completes, the system has a durable list of everything that must be processed before publication is allowed.

### Stage 2: Fetch Content

Responsibilities:
- fetch article/page content for each pending item,
- clean and normalize the fetched text,
- record fetch quality and method,
- record failures and retry eligibility,
- transition items toward enrichment readiness.

This stage is separated from enrichment because external content retrieval is slow, heterogeneous, and often the first source of instability.

### Stage 3: LLM Enrichment

Responsibilities:
- perform required enrichment for every eligible item,
- write structured enrichment output,
- record model usage and latency,
- retry transient failures,
- transition items into terminal success or terminal failure states.

Phase 1 requires full-item coverage, but the “required enrichment” set must still be bounded and predictable. Every item must receive the required schema, not necessarily the most expensive imaginable enrichment.

### Stage 4: Publish

Responsibilities:
- verify that the run has no non-terminal items remaining,
- assemble the final digest from persisted results,
- render the publish artifact,
- publish/send,
- mark the run published.

Publish never invokes fresh fetch or fresh LLM enrichment. It reads completed state.

## State Model

### Run States

Proposed run states:

- `created`
- `collecting`
- `ready_for_processing`
- `processing`
- `ready_to_publish`
- `publishing`
- `published`
- `failed`

Interpretation:
- `ready_for_processing`: collection and dedupe are complete; workers may proceed.
- `processing`: at least one item is still non-terminal.
- `ready_to_publish`: all items are terminal.
- `published`: final artifact sent or posted successfully.

### Item States

The design should track stage-specific status, not just one overloaded status string.

Recommended item state dimensions:

- `content_status`
  - `pending`
  - `running`
  - `done`
  - `failed`
  - `skipped`

- `enrichment_status`
  - `pending`
  - `running`
  - `done`
  - `failed`
  - `skipped`

- `final_status`
  - `pending`
  - `ready`
  - `fetch_failed`
  - `enrichment_failed`
  - `skipped_by_policy`
  - `published`

The final status is what matters for publish gating.

## Terminal-State Rule

This is the most important semantic rule in the design.

Publication requires **all items in the run to be terminal**, not necessarily all to be successful.

Allowed terminal states:
- `ready` (successful fetch + successful enrichment)
- `fetch_failed`
- `enrichment_failed`
- `skipped_by_policy`

This avoids a deadlock where one permanently bad URL prevents the digest from ever being released.

In other words, “complete” means “all items have been fully adjudicated,” not “all items succeeded.”

## Required Enrichment Schema

Phase 1 requires every item to receive one bounded, required enrichment payload. The exact field names can align with current project terminology, but the schema should stay intentionally limited so throughput remains predictable.

Recommended required fields:
- normalized summary,
- why-it-matters,
- topic classification,
- relevance score or relevance bucket,
- optional structured metadata already used by the current digest if cheap enough.

Phase 1 should not require a second heavy enrichment pass for every item. The purpose is full coverage without timeout, not maximum per-item richness.

## Persistence Model

SQLite is the chosen persistence layer because it is sufficient for the current project scale, avoids external dependencies, and supports both pipeline coordination and later website consumption.

### Core Tables

#### `runs`
Suggested fields:
- `id`
- `window_date`
- `status`
- `started_at`
- `collection_completed_at`
- `completed_at`
- `published_at`
- `total_items`
- `terminal_items`
- `successful_items`
- `failed_items`
- `metadata_json`

#### `items`
Suggested fields:
- `id`
- `run_id`
- `source_id`
- `url`
- `title`
- `published_at`
- `dedupe_key`
- `content_status`
- `enrichment_status`
- `final_status`
- `retry_count_fetch`
- `retry_count_enrichment`
- `priority`
- `created_at`
- `updated_at`

#### `item_contents`
Suggested fields:
- `item_id`
- `raw_content`
- `clean_content`
- `content_length`
- `fetch_method`
- `fetch_started_at`
- `fetch_completed_at`
- `fetch_duration_ms`
- `fetch_error`

#### `item_enrichments`
Suggested fields:
- `item_id`
- `model`
- `prompt_version`
- `summary`
- `why_it_matters`
- `topics_json`
- `relevance_score`
- `relevance_bucket`
- `raw_response`
- `tokens_in`
- `tokens_out`
- `duration_ms`
- `created_at`

#### `item_attempts`
Suggested fields:
- `id`
- `item_id`
- `stage` (`fetch` or `enrichment`)
- `attempt_number`
- `started_at`
- `completed_at`
- `duration_ms`
- `outcome`
- `error_message`

This table is essential for diagnosing timeout behavior and slow-item patterns over time.

## Worker Model

### Fetch Worker Pool

Characteristics:
- small bounded concurrency,
- short per-item timeout,
- explicit recording of method used,
- fallback support where existing project adapters already support it,
- retry only for transient failures.

The fetch pool should not block on enrichment capacity.

### Enrichment Worker Pool

Characteristics:
- separate bounded concurrency,
- explicit item claiming from pending rows,
- structured retries,
- deterministic transition to terminal failure after retry budget is exhausted.

The enrichment pool should operate only on items whose content stage has completed successfully or whose existing metadata is sufficient per policy.

## Scheduling Model

This design assumes a publish window rather than one rigid timestamp.

Recommended operational flow:
1. create the run at or before the publish window,
2. perform collection,
3. start fetch/enrichment workers,
4. continue processing until all items reach terminal state,
5. publish immediately upon run readiness.

This preserves the user’s “publish only when complete” rule while removing the need to finish the entire system in one synchronous command execution.

## Publish Gating Logic

A run is publishable only when all of the following are true:

- no items remain in `pending` or `running` stage states,
- every item has a terminal `final_status`,
- the run has not already been published,
- final artifact generation succeeds.

The publish job must be idempotent. Re-running publish after a crash should either complete safely or detect that publication already happened.

## Failure Handling

### Fetch Failures

Policy:
- retry transient fetch failures,
- record terminal `fetch_failed` when retry budget is exhausted,
- keep the item in the run so reporting and later diagnostics remain accurate.

### Enrichment Failures

Policy:
- retry transient LLM/provider failures,
- record terminal `enrichment_failed` when retry budget is exhausted,
- keep the item in the run and allow the run to complete once all items are terminal.

### Run Failure

A run should move to `failed` only for true systemic cases, for example:
- database unavailable,
- schema mismatch,
- a fatal orchestration bug,
- or publication artifact generation irrecoverably fails.

Normal bad items should not fail the run.

## Observability Requirements

Phase 1 should improve operator visibility, not reduce it.

Minimum useful run-level reporting:
- total discovered items,
- deduped items,
- fetch done / failed counts,
- enrichment done / failed counts,
- items remaining,
- per-stage duration,
- slowest sources or items,
- final terminal-state distribution.

This should be available both in logs and in an inspectable persisted form.

## Backward Compatibility and Migration Shape

The current digest scripts should be preserved where practical, but their role changes:

- existing ingestion logic becomes Stage 1 inputs,
- existing content extraction logic becomes Fetch worker behavior,
- existing enrichment logic becomes Enrichment worker behavior,
- existing digest rendering becomes Publish behavior.

The key migration principle is to reuse domain logic while changing orchestration and persistence.

## Implications for Later Phases

Although website publishing and human feedback are out of scope for Phase 1, this design intentionally prepares for them by persisting:
- topics,
- relevance,
- summary,
- why-it-matters,
- and per-item identity.

Phase 2 can therefore read from the same SQLite store rather than inventing a second content system.

## Testing Strategy

Testing should cover:

1. **state transitions**
   - runs and items move through valid states only.

2. **worker claiming and completion**
   - workers do not double-process the same item under normal conditions.

3. **retry semantics**
   - transient failures retry; terminal failures settle correctly.

4. **publish gating**
   - publish does not trigger until all items are terminal.

5. **idempotency**
   - rerunning worker or publish commands after interruption is safe.

6. **migration compatibility**
   - existing digest output still renders from persisted enriched items.

## Risks and Trade-Offs

### More moving parts

This design is more complex than the current single synchronous flow. That is intentional; the current design is too coupled to scale to full-item enrichment.

### SQLite write coordination

SQLite is sufficient here, but worker claiming and updates must be done carefully with transactions so concurrent workers do not step on one another.

### Cost growth from full-item enrichment

Because all items now require enrichment coverage, provider cost and total throughput pressure may increase. That is acceptable for Phase 1 only if the required schema remains bounded.

### Terminal-state publishing means some items may fail

This is an explicit trade-off. The run can finish and publish even when some items are terminal failures. The alternative is an operationally brittle system that can deadlock forever.

## Final Decision

Phase 1 will be implemented as a medium-scope architecture upgrade that introduces SQLite-backed persistence, run/item state tracking, separate fetch and enrichment workers, and publish gating based on full terminal-state completion of the run.

This is the smallest design that meaningfully solves the user’s core requirement: process all items with required LLM enrichment and publish only after the whole run is complete, without depending on one monolithic synchronous job to survive end-to-end.
