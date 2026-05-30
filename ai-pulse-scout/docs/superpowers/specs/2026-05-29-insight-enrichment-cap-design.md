# AI Pulse Scout insight enrichment cap design

## Goal

Reduce end-to-end digest runtime by limiting expensive LLM-based per-item insight enrichment to only the highest-priority items after dedupe and ordering.

## Problem

The current pipeline now successfully:
- filters non-AI items per source
- caps each source to top 10
- prevents indefinite LLM hangs via timeout + fallback

However, runtime is still too high because `enrichKeyInsights()` is called on the full deduped candidate set. In practice this still leaves roughly 140 items entering per-item LLM analysis, which is too slow even with 8-second timeout fallback.

## User intent

The user wants to first observe the current effect, then apply the next most effective runtime reduction if needed.
Observed runtime confirms that the next bottleneck is per-item insight enrichment volume.

## Recommended approach

Only run `enrichKeyInsights()` on the top 12 items after dedupe and selection ordering.

That means:
1. ingest + AI relevance filtering + per-source cap remain unchanged
2. global dedupe remains unchanged
3. global ordering remains unchanged
4. only the first 12 ordered items are passed into `enrichKeyInsights()`
5. executive brief generation continues to use the enriched selected set
6. the email body continues to render only the enriched selected set

## Why 12

12 is a conservative operating cap:
- small enough to materially reduce runtime
- large enough to preserve breadth in the digest
- aligned with an executive-email reading pattern better than analyzing 100+ items

## Alternatives considered

### Option A: reduce LLM timeout further

Rejected as the primary next step because it shortens wait time per item but does not address the multiplicative cost of analyzing too many items.

### Option B: limit enrichment to top N items after ordering

Chosen because it attacks the real runtime driver directly: item count entering the expensive LLM stage.

### Option C: remove per-item enrichment entirely

Rejected because the digest still benefits from item-level insight text and structured executive signals.

## Detailed design

## Enrichment cap point

The cap applies after `selectItems()` returns the globally ordered list and before `enrichKeyInsights()` is called.

Conceptually:

```text
ingest -> source filter/cap -> dedupe -> global select/order -> top 12 -> enrichKeyInsights -> executive brief -> render/send
```

## Behavior

- If selected item count is `<= 12`, enrich all selected items.
- If selected item count is `> 12`, enrich only the first 12 items.
- No second-tier enrichment pass is introduced.
- No additional ranking model is introduced.

## Logging

Add an explicit log line showing:
- selected item count before enrichment
- enrichment cap value
- actual item count sent into `enrichKeyInsights()`

## Scope

Apply the same cap to:
- daily digest runs
- backfill runs

This keeps behavior consistent and predictable.

## Non-goals

This change does not:
- alter source relevance filtering
- alter per-source top-10 capping
- alter dedupe behavior
- alter subject generation
- redesign the email template
- redesign executive brief prompting

## Acceptance criteria

1. daily digest no longer attempts per-item LLM enrichment for the full post-dedupe candidate set
2. only the first 12 ordered selected items are enriched
3. backfill uses the same enrichment cap behavior
4. logs clearly show the selected count and enrichment count
5. existing tests continue to pass, with new tests covering capped enrichment behavior
