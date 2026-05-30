# AI Pulse Scout Phase 1 Full-Item Async Enrichment Design

Date: 2026-05-30  
Branch: `feature/ai-pulse-scout-mvp`

## Summary

This design defines Phase 1 of the next AI Pulse Scout evolution: move from a single long-running synchronous digest job to a persisted run-based pipeline that can process all discovered items, perform required LLM enrichment for every item when processing succeeds, and publish once the run has crossed a defined completion threshold.

The key operational rule for this phase is:

- try to process all discovered items,
- but do not block publication forever on a minority of bad items,
- and allow publication when failed items are no more than 50% of total discovered items.

Failed items must be explicitly marked and carried into later retry/send handling rather than silently disappearing.

The chosen approach is a medium-scope architectural upgrade that keeps the current Node/TypeScript and script-driven structure, while adding SQLite persistence, explicit run/item state tracking, and asynchronous worker stages for content fetch and enrichment.

## Goals

- Ensure every discovered item enters the processing pipeline for the run.
- Ensure every item is attempted for required LLM enrichment coverage in Phase 1.
- Eliminate dependence on one monolithic synchronous job that must finish end-to-end before timing out.
- Publish when the run crosses a defined completion threshold, rather than waiting for perfect success.
- Preserve the current repository’s script-first operational model rather than introducing external infrastructure.
- Create a durable foundation for later web publishing and human feedback loops.
- Explicitly track and preserve failed items for retry in a later send.

## Non-Goals

- Do not implement the web publishing UI in this phase.
- Do not implement per-item human feedback capture in this phase.
- Do not move to Redis, Postgres, or a distributed queue.
- Do not fully service-ize the project into long-running daemons as the primary architecture.
- Do not redesign source selection or relevance-learning logic yet, beyond preserving fields needed by later phases.

## Constraints Confirmed

- Scope is limited to Phase 1.
- All discovered items in a run should be attempted.
- Publication does not require perfect completion.
- Publication is allowed when failed items are no more than 50% of total discovered items.
- Failed items must be marked and retried in a later send.
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
- and gate publication on a defined success/failure threshold rather than on one process staying alive for the entire duration.

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
- Enables retries, progress tracking, threshold-based publish gating, and deterministic carry-forward of failed items.
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
- and publish gating that allows publication once the run has crossed a defined completion threshold and failed items remain within tolerance.

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

This stage is responsible for establishing the run ledger. After it completes, the system has a durable list of everything that should be attempted before publication can be evaluated.

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
- transition items into success, retryable, or terminal failure states.

Phase 1 requires full-item attempt coverage, but the “required enrichment” set must stay bounded and predictable. Every item should be attempted for the required schema, but publication must not wait forever for the minority of items that repeatedly fail.

### Stage 4: Publish

Responsibilities:
- verify that the run has reached a publishable threshold,
- assemble the final digest from persisted successful results,
- render the publish artifact,
- publish/send,
- mark the run published,
- preserve failed items for later retry/send.

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
- `processing`: the run is still being worked and publish eligibility has not yet been reached.
- `ready_to_publish`: the run has crossed the publish threshold.
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
  - `deferred_for_retry`
  - `published`

The final status is what matters for publish gating and carry-forward handling.

## Publish Threshold Rule

This is the most important semantic rule in the design.

Publication does **not** require all items in the run to be terminal, and does **not** require all items to succeed.

Instead, a run becomes publishable when both are true:

1. enough items have finished successfully to produce the day’s digest, and
2. the number of failed items is **no more than 50% of total discovered items**.

Failed items are those whose final status is one of:
- `fetch_failed`
- `enrichment_failed`

Successful publishable items are those whose final status is:
- `ready`

Items that are still retryable at the publish point should be converted into `deferred_for_retry` or equivalent carry-forward tracking and excluded from the current digest.

This avoids a deadlock where a minority of permanently bad or slow items prevents the digest from being released. It also matches the user’s operational rule: if errors stay within 50%, publish now, mark the failed items, and try them again on the next send.

## Required Enrichment Schema

Phase 1 requires every item to be attempted with one bounded, required enrichment payload. The exact field names can align with current project terminology, but the schema should stay intentionally limited so throughput remains predictable.

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
- `deferred_items`
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
- `carry_forward_run_id`
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

The enrichment pool should operate only on items whose content stage has completed successfully or whose existing metadata is sufficient per policy. Items that miss the publish window or exhaust retry budget should be explicitly marked for next-run retry or terminal failure rather than silently disappearing.

## Scheduling Model

This design assumes a publish window rather than one rigid timestamp.

Recommended operational flow:
1. create the run at or before the publish window,
2. perform collection,
3. start fetch/enrichment workers,
4. continue processing through the window,
5. publish once the run crosses the success threshold and the failed-item share is still at or below 50%,
6. retain failed items for retry on the next send.

This preserves the user’s updated rule while removing the need to finish the entire system in one synchronous command execution.

## Publish Gating Logic

A run is publishable only when all of the following are true:

- the count of failed items is at or below 50% of total discovered items,
- there are enough `ready` items to render a meaningful digest,
- the run has not already been published,
- final artifact generation succeeds.

Items may still exist in non-terminal retryable states at publish time, but those items must be excluded from the current digest and carried forward for retry/next-send handling.

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
- keep the item in the run and allow the run to publish if the threshold policy is still satisfied.

### Deferred Retry Handling

Policy:
- items that are still incomplete but not worth blocking publication should be marked `deferred_for_retry`,
- those items should be visible in reporting,
- and they should be eligible for inclusion in the next send/run according to carry-forward policy.

### Run Failure

A run should move to `failed` only for true systemic cases, for example:
- database unavailable,
- schema mismatch,
- a fatal orchestration bug,
- or publication artifact generation irrecoverably fails.

Normal bad items should not fail the run. A run should fail only when it cannot even evaluate or publish against the threshold policy.

## Observability Requirements

Phase 1 should improve operator visibility, not reduce it.

Minimum useful run-level reporting:
- total discovered items,
- deduped items,
- fetch done / failed counts,
- enrichment done / failed counts,
- items remaining,
- current failed-item ratio,
- whether the run has crossed the publish threshold,
- per-stage duration,
- slowest sources or items,
- final status distribution.

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
   - publish does not trigger until the failed-item ratio is within policy and enough successful items exist.

5. **idempotency**
   - rerunning worker or publish commands after interruption is safe.

6. **carry-forward behavior**
   - deferred or failed items are retained for next-send retry handling.

7. **migration compatibility**
   - existing digest output still renders from persisted enriched items.

## Risks and Trade-Offs

### More moving parts

This design is more complex than the current single synchronous flow. That is intentional; the current design is too coupled to scale to full-item enrichment.

### SQLite write coordination

SQLite is sufficient here, but worker claiming and updates must be done carefully with transactions so concurrent workers do not step on one another.

### Cost growth from full-item enrichment

Because all items now require enrichment attempts, provider cost and total throughput pressure may increase. That is acceptable for Phase 1 only if the required schema remains bounded.

### Threshold-based publishing means some items may be deferred

This is an explicit trade-off. The run can publish while some items have failed or are deferred for retry, as long as those failures remain within the 50% tolerance. The alternative is an operationally brittle system that can deadlock forever.

## Final Decision

Phase 1 will be implemented as a medium-scope architecture upgrade that introduces SQLite-backed persistence, run/item state tracking, separate fetch and enrichment workers, and publish gating based on a tolerated failed-item threshold.

The concrete policy for this phase is: if failed items are no more than 50% of total discovered items, publish the successful subset, mark failed items explicitly, and carry them into later retry/send handling.

This is the smallest design that meaningfully solves the user’s updated core requirement: attempt all items, enrich as many as possible, avoid timeout-driven deadlock, and publish once error volume stays within an acceptable operational boundary.
