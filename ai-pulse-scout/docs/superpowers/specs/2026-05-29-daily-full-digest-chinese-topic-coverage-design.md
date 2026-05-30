# AI Pulse Scout daily digest redesign: Chinese full digest with topic coverage and partial LLM enrichment

## Goal

Redesign the daily 07:00 digest so it sends a full daily email that is readable, operationally stable, and aligned with the user's preferred consumption format.

## Confirmed requirements

The user explicitly wants the daily 07:00 email behavior to become:

1. daily scheduled send at 07:00 local time
2. not a 12-item curated digest
3. no LLM executive brief section
4. keep item-level LLM enrichment
5. only the first 50 selected items receive LLM enrichment
6. items beyond the first 50 are still included in the email, but rendered from summary/fallback text without additional LLM calls
7. the full email content should be in Chinese
8. the email layout should use clear divider lines for readability
9. if a topic has updates that day, that topic must appear in the email
10. selection for the first 50 enriched items should follow global ordering, after ensuring topic coverage

## Non-goals

This redesign does not:

- change the AI relevance gate
- change the per-source top-10 cap
- remove dedupe
- add a second email mode for daily sends
- introduce a new admin UI
- require full LLM processing for every item

## Existing pipeline constraints

The current system already improved ingestion stability by:

- filtering non-AI items before ranking
- capping each source to top 10 items before merge
- deduping globally
- adding LLM timeout fallback

However, fully enriching all post-dedupe items is too slow for reliable daily operation. The redesign therefore separates:

- inclusion in the email
- LLM enrichment eligibility

## Recommended approach

Use a two-tier rendering model:

- all selected daily items are included in the email
- only the first 50 selected items receive item-level LLM enrichment
- all later items render from deterministic fallback Chinese summary text

This preserves breadth while keeping the expensive LLM work bounded.

## Alternatives considered

### Option A: enrich every included item

Rejected because daily 07:00 delivery would remain vulnerable to long total runtime.

### Option B: enrich only the first 50 included items and fall back for the rest

Chosen because it preserves full daily coverage while bounding expensive LLM work.

### Option C: remove all LLM enrichment

Rejected because the user explicitly wants item-level LLM enrichment to remain.

## High-level design

## Selection model

The selection pipeline becomes:

```text
ingest -> AI relevance filter -> per-source top 10 -> dedupe -> global order -> topic coverage pass -> full ordered digest list
```

The email is not truncated to 12 or 50 items.

Instead:

- the final digest list includes all selected daily items
- the first 50 items in that final list are marked for LLM enrichment
- remaining items are rendered with non-LLM fallback text

## Topic coverage rule

If a topic has at least one item in the daily candidate set, that topic must appear in the email.

Implementation rule:

1. group candidates by topic after global ordering is available
2. pick the highest-ranked item from each topic that has at least one candidate
3. preserve relative global ordering when building the final digest list
4. then append the remaining items in global order

This ensures:

- every active topic is represented
- overall ranking still dominates the digest structure
- no topic disappears merely because another topic has heavier volume

## LLM enrichment rule

### Executive brief

Disable daily executive brief generation entirely.

The email will no longer render an executive-brief section.

### Item-level enrichment

Apply item-level LLM enrichment only to the first 50 items in the final digest list.

Rules:

- if final item count is `<= 50`, enrich all items
- if final item count is `> 50`, enrich only items `0..49`
- item `50+` must not trigger additional LLM requests

## Fallback rendering for non-enriched items

Items beyond the enrichment boundary should still render in Chinese using deterministic fallback text.

Fallback priority:

1. existing `key_insight` if already available without new LLM work
2. normalized summary text
3. content excerpt
4. short fixed Chinese fallback line when source text is sparse

This fallback must be Chinese even when the source content is English.

## Chinese daily digest requirement

The entire email should be user-facing Chinese.

This includes:

- email header labels
- topic headings
- item metadata labels
- item explanation labels
- fallback text labels
- empty-state text
- footer text
- link prompts

Topic display names should be mapped into Chinese display labels while keeping internal topic identifiers unchanged.

## Layout redesign

The daily email should remain simple HTML email, but gain stronger structural separation for long-form reading.

Required layout changes:

- a clear header separator below the title block
- a distinct separator between topic sections
- a separator between item entries
- stronger topic-section heading treatment for scanning
- no executive-brief block

The goal is readability for large emails, especially when item count exceeds 50 or 100.

## Scheduling behavior

The 07:00 launchd daily runner should point to the formal production daily CLI, not the current test-oriented entrypoint name.

Desired behavior:

- schedule remains 07:00 local time
- launchd invokes the production daily-send command
- logs still land in the project log directory

## Component changes

### 1. Daily selection helper

Add or update a helper that:

- accepts globally ordered items
- guarantees one representative item for every active topic
- returns the final digest order

### 2. Enrichment boundary helper

Add or update a helper that:

- takes the final digest list
- enriches only the first 50 items
- returns one combined list for rendering

### 3. Chinese fallback text helper

Add deterministic Chinese fallback generation for non-enriched items.

### 4. Topic label mapping

Add a stable mapping from internal topic names to Chinese display labels.

### 5. HTML renderer update

Update email rendering so:

- executive brief is absent
- all labels are Chinese
- separators are visually stronger
- enriched and fallback items share a coherent presentation

### 6. CLI / schedule cleanup

Rename or add a clear production daily CLI and update `scripts/send-daily.sh` to use it.

## Testing strategy

Add or update tests for:

1. topic coverage behavior
   - when multiple topics have items, each topic appears at least once
   - global order remains stable after topic-coverage injection

2. enrichment boundary
   - first 50 items are enriched
   - item 51+ are not enriched
   - final rendered list still includes all items

3. Chinese rendering
   - renderer outputs Chinese labels and omits executive brief
   - topic headings use Chinese display names

4. fallback rendering
   - non-enriched items render Chinese fallback text

5. daily job behavior
   - daily job returns full digest item count
   - daily job does not call executive brief generation

6. schedule runner
   - runner script points to the production daily CLI

## Acceptance criteria

The redesign is complete when all of the following are true:

1. the 07:00 daily digest includes all selected daily items, not only 12 or 50
2. if a topic has updates that day, the email contains at least one item from that topic
3. only the first 50 final items receive LLM enrichment
4. items after the first 50 are still included and rendered with deterministic Chinese fallback text
5. daily executive brief is disabled and absent from the email
6. the entire user-facing email is in Chinese
7. the layout uses clear divider lines and improved section readability
8. the launchd runner points to the formal daily production entrypoint
9. tests cover topic coverage, 50-item enrichment boundary, and Chinese rendering behavior
