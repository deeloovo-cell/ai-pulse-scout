# Webpage Extraction Quality Design

Date: 2026-05-26
Branch: `feature/ai-pulse-scout-mvp`
Status: Draft for review

## Goal

Upgrade `webpage` ingestion from the current heuristic placeholder into a production-usable layered extractor that can handle:

- blog/news entry pages
- normal article detail pages
- listing/index/home pages

The design must preserve the compatibility-first migration path already in progress:

- unified ingestion stays the production entrypoint
- legacy digest consumers can continue working during migration
- webpage ingestion may emit both article-grade items and degraded link-grade items
- support state reporting must remain honest rather than pretending all webpage sources are equally mature

## Product Decisions Confirmed

The user selected the following behavior:

1. Cover all webpage source shapes rather than prioritizing only one class.
2. Use a balanced strategy rather than purely conservative or purely aggressive extraction.
3. Prefer article-grade items, but allow degraded link-grade items when full extraction is not possible.
4. Treat missing timestamps in layers:
   - article-grade items should prefer real published time
   - degraded link-grade items may fall back to `discoveredAt`
5. For listing/index pages, use a layered strategy:
   - discover candidate links
   - attempt detail-page upgrade
   - preserve degraded link-grade items if upgrade fails

## Approaches Considered

### A. Strict article extraction only

Only accept webpages that yield title, canonical URL, published time, and enough article body content.

**Pros**
- clean downstream data
- predictable digest quality

**Cons**
- poor coverage
- many valuable non-feed sources would produce zero output

### B. Link discovery first

Treat webpage ingestion mainly as a link discovery system, and rely on downstream filtering and digest selection to clean it up.

**Pros**
- high coverage
- fast source expansion

**Cons**
- noisier output
- weaker timestamps
- more burden on dedupe and selection

### C. Layered upgrade path (chosen)

Run webpage ingestion as:

`entry page -> candidate discovery -> detail upgrade -> degraded preservation`

**Pros**
- balances coverage and quality
- aligns with the user’s selected behavior at every decision point
- gives better observability into what is high-confidence vs degraded

**Cons**
- more implementation work than A or B
- requires explicit extraction metadata and scoring boundaries

## Recommended Design

Adopt **Approach C**.

The system should try to turn webpage sources into article-grade items whenever possible, but should not collapse to zero output just because a detail page cannot be fully upgraded. Instead, the adapter should preserve high-confidence discovered links as degraded items with explicit extraction metadata.

## Architecture

The current `genericWebAdapter.ts` should stop absorbing all responsibilities directly. The webpage ingestion path should be split into smaller units with clear boundaries.

### 1. Entry classifier

**Input**
- source URL
- entry-page HTML

**Output**
- `feed_page`
- `article_page`
- `listing_page`
- `unknown_page`

**Responsibility**
Determine which processing path should run next.

### 2. Candidate extractor

**Input**
- listing/index/home page HTML
- base URL

**Output**
- ranked candidate article URLs

**Responsibility**
Find likely article links while filtering obvious utility or navigation pages.

### 3. Detail extractor

**Input**
- detail page HTML
- page URL

**Output**
- title
- canonical URL
- published timestamp
- content text
- summary material
- extraction evidence

**Responsibility**
Promote a candidate URL into an article-grade extraction when possible.

### 4. Webpage normalizer

**Input**
- raw extraction result

**Output**
- `IngestedItem`

**Responsibility**
Map both article-grade and degraded-link-grade results into the shared unified ingestion schema while preserving legacy digest-facing fields.

### 5. Webpage adapter orchestrator

**Responsibility**
Coordinate the flow:

- fetch entry page
- classify page type
- use feed auto-discovery when available
- extract candidates from listing pages
- fetch detail pages for top candidates
- emit article-grade items when upgraded
- emit degraded items when upgrade fails but the link still looks valid

The adapter should orchestrate, not bury all HTML-specific logic inside one file.

## Processing Flow

For each webpage source:

### Phase 1: Entry-page classification

Fetch the source URL and classify it into one of:

- `feed_page`
- `article_page`
- `listing_page`
- `unknown_page`

Classification signals may include:

- RSS/Atom discovery tags
- article-specific metadata (`article:published_time`, JSON-LD article schema, `<article>` density)
- listing patterns (multiple article-like links, repeated cards, blog/news path structures)
- absence of useful article or listing signals

### Phase 2: Primary ingestion path

#### If feed-capable
Use feed auto-discovery first and continue to rely on the feed-backed path when present.

#### If direct article page
Attempt immediate detail extraction and emit an article-grade item if sufficient signals are present.

#### If listing page
Extract and rank candidate links.

### Phase 3: Detail-page upgrade

For listing-derived candidates:

- fetch detail page for the top N candidates
- attempt title, canonical URL, published time, and main-content extraction
- normalize successful results into article-grade items

### Phase 4: Degraded preservation

If detail extraction fails, but the candidate link remains high-confidence as a likely new article, emit a degraded link-grade item instead of dropping it entirely.

This preserves coverage while making the quality level explicit.

## Data Model

The design should keep the shared `IngestedItem` contract and add webpage-specific quality metadata in `rawMetadata` or in a dedicated extraction metadata block reachable through adapter output.

### Extraction level

Each webpage-derived item should carry one of:

- `article_full`
- `article_partial`
- `link_only`

Definitions:

- `article_full`: title, canonical URL, article text, and timestamp are sufficiently complete
- `article_partial`: article extraction succeeded partially, but content or timestamp quality is incomplete
- `link_only`: the system recognizes a high-confidence article-like link, but could not promote it into article content

### Timestamp confidence

The item should preserve `publishedAtConfidence`, with webpage-specific use:

- `exact`
- `derived`
- `fallback_discovered_at`

Rules:

- article-grade items should prefer `exact`, then `derived`
- degraded link-grade items may use `fallback_discovered_at`

### Degrade reason

When the item is not `article_full`, record a specific reason such as:

- `detail_fetch_failed`
- `content_extraction_failed`
- `missing_published_at`
- `insufficient_article_signals`
- `listing_only_candidate`

### Candidate origin

Track how the item was discovered:

- `feed_auto_discovery`
- `entry_page_direct_article`
- `listing_page_candidate`
- `listing_page_upgraded_detail`

This makes support-state and extraction-quality analysis much more useful.

## Downstream Consumption Rules

The first implementation should preserve compatibility with existing digest consumers while making better use of webpage quality signals.

### Selection

- `article_full`: normal eligibility
- `article_partial`: eligible, but lower preference than `article_full`
- `link_only`: eligible only as degraded low-priority material

### Timestamps

- items with real published time should rank above items using `fallback_discovered_at`
- missing true publish time should not automatically exclude degraded items

### Rendering

Renderer should remain user-friendly and should not expose engineering-heavy extraction tags in the email body by default.

### Dedupe and ledger

The existing compatibility-first item identity rules should continue to apply:

- prefer `stableIdentity`
- fall back to canonical/item URL fingerprints where needed

## Error Handling

The webpage adapter should fail honestly but not collapse the whole source unnecessarily.

### Source-level outcomes

- `production_supported`: when full article-grade extraction works reliably for the source in the current run
- `partial_supported`: when candidate discovery or partial extraction works, but full extraction is incomplete
- `broken`: when the entry page cannot be fetched or parsed meaningfully

### Non-fatal failures

Treat these as degradation, not full source failure:

- one or more candidate detail pages fail to fetch
- content extraction fails for some candidates
- publish time is missing for a subset of candidates

### Fatal failures

Treat these as broken when the source cannot produce anything meaningful:

- entry page fetch failure
- HTML unreadable or empty
- no usable article, listing, or feed signals and no high-confidence degraded candidates

## Limits and Scope Control

To keep the first version implementable, the initial release should include these boundaries:

- upgrade only the top N listing candidates per source run
- no infinite pagination
- no browser-rendering dependency
- no login-required pages
- no site-specific scraper explosion in v1

The first version should remain rule-based over fetched HTML and not depend on full browser automation.

## Testing Strategy

The implementation should be test-driven and split by component boundary.

### Unit tests

1. Entry classifier
   - feed page classification
   - direct article classification
   - listing page classification
   - unknown page classification

2. Candidate extractor
   - prefers article-like links
   - excludes obvious navigation/utility links
   - deduplicates and normalizes URLs

3. Detail extractor
   - extracts title/canonical/published/content from article-like HTML
   - handles missing timestamp
   - handles weak-content pages gracefully

4. Webpage normalizer
   - maps `article_full`, `article_partial`, and `link_only` into `IngestedItem`
   - preserves compatibility fields for digest consumers

### Adapter integration tests

- feed auto-discovery path
- direct article path
- listing -> detail upgrade path
- listing -> degraded link fallback path
- source broken path

### Digest compatibility tests

- degraded webpage items do not break selection
- fallback timestamp items do not break rendering
- webpage items continue to participate in dedupe and ledger logic

## Success Criteria

This design is successful when:

1. webpage sources produce higher-quality article-grade items than the current heuristic placeholder path
2. listing pages can upgrade at least some candidates into article-grade items
3. upgrade failures degrade gracefully instead of turning the source into zero output
4. downstream digest code can distinguish high-confidence vs degraded webpage items
5. support-state reporting remains honest about production vs partial support

## Out of Scope for This Iteration

The following are explicitly not required for the first implementation:

- browser-rendered JavaScript execution
- authenticated source handling
- multi-page crawling depth beyond the configured candidate cap
- site-specific extraction packs for every domain
- rewriting the entire digest renderer around webpage metadata

## Implementation Impact

The main files likely affected in the next implementation plan are:

- `src/adapters/genericWebAdapter.ts`
- new webpage extraction helpers under `src/adapters/shared/` or a webpage-specific helper folder
- downstream compatibility surfaces already identified earlier:
  - `src/filtering/selectItems.ts`
  - `src/normalize/normalizeItem.ts`
  - `src/render/renderHtmlEmail.ts`
  - `src/state/ledger.ts`
  - `src/insights/analyzeKeyInsights.ts`

## Recommendation

Proceed with a compatibility-first implementation of layered webpage extraction using explicit extraction-level metadata, timestamp-confidence modeling, and degraded-item preservation.

This keeps the migration moving forward without pretending webpage ingestion is either fully solved or unusable.
