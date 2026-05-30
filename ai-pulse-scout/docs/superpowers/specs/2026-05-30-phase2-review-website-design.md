# AI Pulse Scout Phase 2 Review Website Design

## Summary

Phase 2 shifts AI Pulse Scout's primary reading surface from scheduled email delivery to a private internal review website. The website must render the exact same final digest items that the scheduled email pipeline is supposed to show, but present them in a simpler web-native review feed.

The Phase 2 v1 website is a single-user internal tool with a rolling 5-day history. It displays final digest items in one chronological feed, removes email-style grouping, uses topic tags on each card, and supports persisted human interactions through star ratings and a follow-up checkbox.

## Goals

- Make the website the main review surface for AI Pulse Scout digest output.
- Keep website item scope fully aligned with the scheduled email's final selected digest items.
- Replace grouped email rendering with a simpler single-column review feed.
- Persist lightweight human feedback on each digest item.
- Keep the initial version private, single-user, and operationally simple.

## Non-Goals

Phase 2 v1 does not include:

- multi-user collaboration
- authentication or permissions system
- comments or notes
- search or filtering
- candidate-pool review for all discovered items
- public sharing or external publishing
- KB writeback from the review page
- analytics dashboards
- a separate content generation or selection system from email

## Product Requirements

### 1. Item Scope

The website must show the same final items that the scheduled email is supposed to show.

It must not show the broader discovered or enriched candidate pool. Website and email must stay aligned on the final digest item set.

### 2. Feed Layout

The website must render a single-column feed.

The feed must:
- have no grouped sections
- use per-item topic tags instead of grouped topic blocks
- sort items by published date in ascending order

This is intentionally not a web copy of the current email layout.

### 3. Rolling History Window

The website must display a rolling 5-day history of final digest items.

V1 should treat this as one unified review feed covering the recent 5-day window, rather than separate day pages.

### 4. Item Card Content

Each review card must include at least:
- title
- short summary or excerpt
- topic tags
- machine relevance or match indicator
- persisted star rating control
- persisted follow-up checkbox

The page does not need a separate explicit original-link button in v1.

### 5. Persisted Interactions

The following interactions must be real and persisted in v1:
- star rating
- follow-up checkbox state

Persisted state must survive page reloads.

Because v1 is single-user, there is only one saved interaction state per item.

### 6. Product Positioning

The website becomes the primary review experience. Email may continue to exist as a delivery/output surface, but the website is the main product surface for digest consumption and triage.

## System Design

### Source of Truth

The selection pipeline remains the source of truth for which items belong in the digest.

Phase 2 must not create a second selection system for the website. The website should read a stable snapshot of the same post-selection digest output used by the scheduled email flow.

### High-Level Architecture

The Phase 2 v1 system has three layers:

1. **Digest selection layer**
   - existing ingestion, fetch, enrichment, and selection pipeline
   - responsible for producing the final digest items

2. **Review storage layer**
   - stores website-readable snapshots of final digest items
   - stores persisted single-user review state per item

3. **Web app layer**
   - renders the review feed
   - loads the latest 5-day window
   - saves rating and follow-up interactions

## Data Model

### Digest Review Snapshot

Persist a stable snapshot of final digest items for website consumption.

Recommended fields:
- `digest_date`
- `run_id`
- `item_key`
- `published_at`
- `title`
- `excerpt`
- `item_url`
- `source_name`
- `topic_tags_json`
- `match_score`
- `normalized_item_json`
- `created_at`

This snapshot must reflect the same final item set as the scheduled email path.

### Review State

Persist single-user review state per item.

Recommended fields:
- `item_key`
- `rating` (nullable integer from 1 to 5)
- `follow_up` (boolean)
- `updated_at`

No `user_id` is needed in v1.

## API and Route Design

### Page Route

- `GET /`
  - renders the review page for the rolling 5-day window

### Data Route

- `GET /api/review-items`
  - returns the latest 5-day final digest items plus saved review state

Response should be UI-ready and include:
- digest date
- published date
- title
- excerpt
- source URL
- topic tags
- match score
- rating
- follow-up state

### Interaction Routes

- `POST /api/review-items/:itemKey/rating`
  - body: `{ "rating": 1..5 | null }`

- `POST /api/review-items/:itemKey/follow-up`
  - body: `{ "followUp": true | false }`

These routes should save immediately and return updated persisted state.

## Page Behavior

### Feed Behavior

On load, the page should:
- fetch the latest 5-day item window
- merge persisted review state into each item
- sort items by `published_at` ascending
- render one unified feed

### Interaction Behavior

- clicking a star saves rating immediately
- toggling follow-up saves immediately
- page reload restores saved state

### Empty State

If there are no digest items in the latest 5-day window, show a clean empty state such as:

`No digest items available in the last 5 days.`

### Error Handling

If an interaction save fails:
- do not break the feed
- keep feedback local to the affected control
- show lightweight failure feedback
- allow retry

## Consistency Rules

The website and scheduled email must stay consistent in item membership.

That means:
- if an item appears in the scheduled email digest, it should appear in the website review feed
- if an item does not belong to the final digest selection, it should not appear in the website feed

Presentation may diverge between email and web, but final item selection must remain shared.

## Testing Requirements

At minimum, implementation must verify:

1. **snapshot consistency**
   - website snapshot item set matches the final email digest item set

2. **rolling window behavior**
   - only the last 5 days are shown
   - older items are excluded
   - ordering is `published_at` ascending

3. **interaction persistence**
   - ratings persist
   - follow-up state persists
   - reload restores state

4. **API validation**
   - invalid rating values are rejected
   - follow-up accepts only boolean values
   - missing items return a correct error response

5. **empty-state rendering**
   - no recent items still renders a valid page

## Recommended v1 Scope

### In Scope

- private single-user internal website
- same final item set as scheduled email
- rolling 5-day history
- single-column feed
- no grouping
- topic tags on cards
- date ascending ordering
- persisted star rating
- persisted follow-up state

### Out of Scope

- comments and notes
- multi-user support
- authentication
- filters and search
- candidate-pool review
- analytics surfaces
- KB or task integrations from the page
- explicit original-link action button in v1

## Implementation Direction

The recommended implementation approach is a small web app built on top of the existing pipeline and SQLite-backed persisted state introduced in Phase 1.

This approach is preferred over a static page with ad hoc APIs or a fully separate website-specific data model because it:
- preserves alignment with the existing digest pipeline
- avoids product drift between email and web
- reuses the current persistence direction
- creates a clean foundation for future website growth without prematurely overbuilding
