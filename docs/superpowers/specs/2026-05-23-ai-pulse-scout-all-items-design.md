# AI Pulse Scout — All Latest Items Email Design

Date: 2026-05-23

## Goal

Change AI Pulse Scout from a filtered executive digest into a simple **complete latest-items email**.

The new behavior is:
- include **all latest fetched items from all enabled sources** within the normal collection window
- keep **deduplication**
- keep **scoring only for ordering**, not for exclusion
- render items as **one global list**
- make the **link clearly visible** for every item
- avoid adding extra grouping, sections, attachments, or archive workflows

## User Intent

The user does not want a selective digest. They want the email to present the full set of latest items gathered from the configured sources, without hidden filtering. They also explicitly asked to keep the solution simple.

## Recommended Approach

### Option 1 — Full ordered list (recommended)
- Fetch all items in the window
- Deduplicate by existing ledger/fingerprint logic
- Score every remaining item
- Sort all items globally by score descending
- Render every item in the email

**Why this is recommended:**
- exactly matches the user request
- smallest behavior change from current pipeline
- easiest to reason about
- avoids source caps, category grouping, or extra output modes

### Option 2 — Full list sorted by publish time
- Include everything, but sort newest first instead of by score

**Trade-off:** simpler conceptually, but does not preserve the existing relevance model the user still wants for ordering.

### Option 3 — Full list grouped by source/category
- Include everything, grouped visually by source or category

**Trade-off:** more complicated presentation and not what the user asked for.

## Approved Design

The system will behave as a **complete ordered feed email**.

Pipeline:
1. Fetch items from all enabled sources within the existing collection window
2. Deduplicate items exactly as today
3. Score items exactly as today
4. Sort all deduplicated items by score descending
5. Include every sorted item in the email body
6. Send the resulting email

No score threshold and no top-N selection will be applied.

## Architecture Changes

### Current behavior
Current pipeline is effectively:

`sources -> fetch -> dedupe -> score -> select(top N above threshold) -> render -> send`

### New behavior
New pipeline becomes:

`sources -> fetch -> dedupe -> score -> sort(all items) -> render(all items) -> send`

### Component impact

#### 1. Filtering / selection
The selection stage should stop excluding items.

Specifically:
- remove score-threshold-based exclusion from the daily email path
- remove top-N truncation from the daily email path
- preserve deterministic ordering based on score descending
- optionally use published date as a stable tiebreaker if needed

This may be implemented either by:
- replacing `selectItems()` with an `orderItems()` function, or
- changing `selectItems()` semantics so it returns all items in sorted order

Preferred implementation direction: create or rename to a function whose name matches the new behavior, because the system is no longer “selecting” a subset.

#### 2. Rendering
The renderer should continue using a simple item-card layout, but each item must clearly expose its destination link.

Each item should show:
- title
- short summary / key insight text
- source name
- published date if available
- a clear clickable URL presentation

Recommended presentation:
- keep the source link
- additionally show the destination URL as visible text, or use a clearer label such as `Open link:` followed by the actual URL

The purpose is to make it obvious that every item has its own distinct link.

#### 3. Header / framing
The email header should reflect that this is no longer a short executive digest.

Recommended wording:
- title can remain `AI Pulse Scout`
- subtitle or header text should indicate this is **All Latest Items**
- item count should show the full total included in the email

Subject may stay unchanged for compatibility unless implementation convenience suggests a small wording update.

## Data Flow

### Inputs
- enabled sources from `config/sources.yaml`
- digest/scoring config from existing config files
- run window from existing run-state logic
- sent ledger for dedupe protection

### Processing
- fetch candidate items
- normalize items
- dedupe against ledger and within-run duplicates
- score items
- globally sort all scored items
- render all sorted items

### Outputs
- HTML artifact in `data/output/`
- email containing all rendered items
- ledger update after successful send
- run state update after successful send

## Error Handling

Error handling should remain simple and consistent with current behavior:

- source fetch failures do not abort the whole run; successful sources still contribute items
- if zero items remain after fetch + dedupe, skip send as today unless later requirements change
- if email send fails, do not update `last_successful_run`
- if rendering succeeds, keep the HTML artifact for inspection

## Testing Requirements

Implementation should verify:

1. **All-items behavior**
   - a run with many qualified and low-scored items still includes all deduped items

2. **No threshold exclusion**
   - items below the old minimum score are still present in output

3. **No top-N truncation**
   - more than the old max item count are rendered and sent

4. **Ordering still works**
   - higher-scored items appear before lower-scored items

5. **Visible links**
   - rendered HTML clearly contains each item’s distinct URL/link presentation

6. **Existing dedupe still works**
   - duplicate items are not repeated

## Non-Goals

The following are intentionally out of scope:
- category grouping
- source grouping
- source caps
- executive-summary section
- attachments or external archive pages
- changing source coverage policy
- changing collection window logic

## Simplicity Rule

If implementation choices arise, prefer the one that keeps the current pipeline intact and changes only the minimum necessary behavior:
- remove exclusion
- keep ordering
- clarify links

That is the whole feature.

## Success Criteria

This design is successful when:
- the daily email includes all latest deduplicated items from all enabled sources in the current window
- items are globally ordered by score, not filtered by score
- users can clearly see that each item has its own distinct link
- the implementation remains simple and close to the existing pipeline
