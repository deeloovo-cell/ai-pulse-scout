# AI Pulse Scout source-cap and LLM-timeout design

## Goal

Reduce daily digest runtime and eliminate indefinite hangs by:

1. capping each source/feed to its top 10 candidate items before global downstream processing
2. preserving a simple, deterministic ranking rule per source
3. adding timeout protection to LLM calls so digest generation degrades gracefully instead of blocking forever

## User intent

The user wants to change the fetch-content logic so the system no longer allows very large per-source candidate volumes to flow into the expensive insight-generation stage.

They explicitly chose:
- per-source/feed cap, not per-topic or per-category-field cap
- source-level top 10 behavior as the target outcome
- the stronger reliability option: source cap plus LLM timeout/fallback behavior

## Current problem

Today the pipeline behaves like this:

1. ingest all items from all configured sources within the collection window
2. merge all source outputs
3. dedupe globally
4. enrich selected items with LLM-generated insights
5. generate executive brief with another LLM call
6. render and send email

With the current source set, this can produce thousands of items before dedupe. That creates two operational risks:

- downstream LLM work scales poorly
- if the upstream LLM request stalls, the digest can hang indefinitely because the chat-completion request currently has no timeout boundary

## Recommended approach

Implement two coordinated protections.

### 1. Per-source top-10 cap before global merge

After each source is ingested and normalized for the active time window, sort that source's items using a deterministic ranking rule and keep only the top 10 items from that source.

Only those capped results continue into the merged global item set.

### 2. Timeout-protected LLM requests with graceful fallback

Wrap chat-completion requests in a request timeout.
If the timeout is reached, treat the request as a recoverable degradation:
- per-item insight generation falls back to the existing non-LLM insight behavior
- executive brief generation falls back to the existing fallback brief behavior
- the digest run continues and can still render/send email

## Alternatives considered

### Option A: cap after global merge

Cap only after all source items have already been merged and deduped.

**Rejected because:**
this does not reduce ingest-to-analysis pressure early enough and still allows oversized source output to burden downstream stages.

### Option B: cap by topic

Cap each business topic to a fixed count.

**Rejected because:**
it requires a stronger and more explicit topic-grouping contract than the system currently has, and would add avoidable complexity to a reliability fix.

### Option C: per-source cap plus timeout fallback

Cap each source to top 10 and harden LLM requests with timeout/fallback.

**Chosen because:**
it directly addresses both scale and hang-risk while keeping the implementation small and aligned with current data structures.

## Detailed design

## Source-level ranking rule

For each source independently, sort candidate items with this priority order:

1. newer effective item time first
2. better extraction quality first
3. more trustworthy timestamp metadata first

This preserves the current project behavior and avoids introducing a new scoring model.

### Effective item time

Use the same effective time logic already used for item ordering:
- prefer `published_at`
- otherwise fall back to `fetched_at`

More recent items rank higher.

### Extraction quality priority

When effective time ties, prefer richer extraction:
- `article_full`
- `article_partial`
- `link_only`
- unknown/default behaves like current middle-tier behavior

### Timestamp confidence priority

When still tied, prefer stronger timestamp confidence:
- exact
- derived
- fallback/discovered

## Where the cap applies

The cap applies after source ingestion returns normalized items for that source and before cross-source merge/global dedupe.

Conceptually:

```text
source ingest -> source-local sort -> source-local top 10 -> merge all sources -> global dedupe -> downstream analysis
```

This means:
- no source contributes more than 10 items into downstream stages
- one very large feed cannot dominate the digest pipeline
- downstream volume becomes bounded by `enabled_source_count * 10`

For the current 18-source setup, the theoretical pre-dedupe maximum becomes 180 items.

## LLM timeout behavior

## Request timeout

Add a timeout boundary to chat-completion requests used by:
- per-item insight generation
- executive brief generation

The timeout should abort the request rather than wait indefinitely.

## Failure handling

Timeouts should be treated as recoverable operational degradation, not fatal run failure.

### Per-item insight generation

If a request times out or fails:
- log a warning with the item title and failure reason
- attach the existing fallback insight behavior
- continue processing remaining items

### Executive brief generation

If the request times out or fails:
- log a warning
- use the existing fallback executive brief
- continue rendering the email

## Logging and observability

Add/retain logs that make the new behavior visible:

- total raw items returned per source
- capped item count per source after ranking/truncation
- total merged item count after source caps
- deduped item count
- warning when LLM timeout fallback is used

This is important so future debugging can distinguish:
- normal capping behavior
- source-level sparsity
- LLM degradation events

## Data-flow impact

Old flow:

```text
all source items -> merge -> dedupe -> enrich -> brief -> render/send
```

New flow:

```text
per-source ingest
-> per-source rank
-> per-source cap to 10
-> merge
-> dedupe
-> enrich with timeout/fallback
-> brief with timeout/fallback
-> render/send
```

## Error handling

### Source returns fewer than 10 items

No special case needed. Keep all available items.

### Source returns 0 items

No special case needed. The source contributes nothing.

### Duplicate items across sources

Still handled by existing global dedupe after per-source capping.

### LLM unavailable or too slow

Digest still completes using fallback insight/brief text.

### All items removed by dedupe

Retain existing empty-digest behavior.

## Testing

Add or update tests to verify:

1. source-local ranking preserves the current priority order
2. source-local cap keeps only the top 10 items from a single source
3. cap happens before global merge/dedupe behavior is finalized
4. multiple sources can each contribute up to 10 items before dedupe
5. LLM timeout causes fallback, not whole-run failure
6. executive brief timeout causes fallback, not whole-run failure

## Non-goals

This change does not:
- redesign source taxonomy
- introduce topic-level quotas
- redesign digest selection after dedupe
- change email template content strategy
- optimize all performance bottlenecks in the pipeline
- redesign the insight prompts

## Expected outcome

With current source counts, the candidate volume entering expensive downstream stages should fall from the current thousands to at most roughly 180 pre-dedupe items.

This should:
- materially reduce runtime and LLM load
- reduce the chance of long or stalled runs
- prevent indefinite hangs once request timeout protection is added
- preserve digest continuity by degrading gracefully instead of failing hard

## Acceptance criteria

The change is successful when all of the following are true:

1. each enabled source contributes at most 10 items into the merged candidate pool
2. per-source item ordering follows the existing recency/extraction/timestamp-priority rule
3. digest runs no longer wait indefinitely on a stalled chat-completion request
4. when LLM requests time out, the digest still renders and can send using fallback content
5. logs make source capping and timeout fallback visible
