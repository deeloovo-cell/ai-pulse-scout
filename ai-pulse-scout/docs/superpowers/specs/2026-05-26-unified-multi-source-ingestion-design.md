# AI Pulse Scout — Unified Multi-Source Production Ingestion Design

**Date**: 2026-05-26  
**Branch**: `feature/ai-pulse-scout-mvp`

## Goal
Upgrade AI Pulse Scout from a feed-centric daily digest into a unified production ingestion system that can ingest enabled sources across RSS, webpage, YouTube, GitHub, docs, community, and papers categories through one real runtime pipeline.

The key outcome is that the daily digest should no longer behave like a feed-only email with extra source inventory on the side. Instead, all production-supported source types should flow through one ingestion path, normalize into one shared item schema, and then use a single downstream digest pipeline for dedupe, ledger suppression, insight generation, rendering, and sending.

## Problem Statement
The codebase currently has two different worlds:

1. **Coverage / discovery adapters**
   - `FeedAdapter`
   - `GenericWebAdapter`
   - `YouTubeAdapter`
   - `GitHubAdapter`
   - These are used by source coverage tooling to probe whether a source appears discoverable.

2. **Production daily digest path**
   - `loadConfig()` loads enabled sources from `config/sources.yaml`
   - `fetchAllSources()` fetches only `rss | atom | podcast`
   - The real email pipeline therefore remains feed-only in practice

This split causes misleading behavior:
- the project appears to support multiple source types
- but the actual daily digest only sends from enabled feed-like sources
- so webpage, YouTube, GitHub, docs, community, and papers sources are either partially covered, discovery-only, or fully excluded from production email output

## Confirmed Requirements

### Functional requirements
- There must be one production ingestion entrypoint for the daily digest.
- Enabled sources must be dispatched by source type / adapter strategy rather than being hard-limited to feeds.
- RSS, webpage, YouTube, GitHub, docs, community, and papers sources are all in scope for the target architecture.
- All adapters must emit a common normalized item shape.
- The downstream digest flow must remain source-agnostic.
- The daily digest must continue honoring the fixed 07:00 Asia/Shanghai cutoff behavior already implemented.
- Existing feed support must not regress while non-feed support is added.
- Ledger and dedupe behavior must continue to prevent repeat sends of the same logical item across mixed source types.

### Operational requirements
- Source support status must become explicit and honest.
- The system must distinguish between:
  - production-supported
  - partially supported
  - discoverable-only
  - deferred
  - broken
- Runtime artifacts under `data/output` and `data/state` remain operational state and should not be committed unless explicitly intended.

### Quality requirements
- Non-feed items need stable identity keys.
- Timestamp extraction must be defined consistently even when sources are weak or partial.
- Content extraction quality must be good enough to support digest summaries and key insights.
- Source-specific noise handling must exist for docs, community, and papers flows.

## Non-Goals
- Pretending every source type is equally mature on day one.
- Removing source inventory entries without explicit approval.
- Reverting the fixed daily cutoff behavior back to rolling-window production behavior.
- Implementing every possible platform-specific integration in one pass.
- Committing runtime output/state artifacts as part of this design work.

## Architecture Overview

### 1. Unified production ingestion entrypoint
Introduce a single production ingestion function, conceptually:

```ts
ingestAllSources(sources, windowStart, windowEnd): Promise<NormalizedItem[]>
```

Responsibilities:
- accept all enabled sources from config
- dispatch each source to the correct adapter
- collect normalized items from every supported source type
- return one merged item stream for downstream digest processing

This replaces the current production dependence on feed-only `fetchAllSources()` as the top-level intake mechanism.

### 2. Adapter-based production ingestion
Adapters stop being only coverage probes and become the production ingestion mechanism.

Target production adapter families:
- `FeedAdapter`
- `WebpageAdapter`
- `YouTubeAdapter`
- `GitHubAdapter`
- `DocsAdapter`
- `CommunityAdapter`
- `PapersAdapter`

Each adapter is responsible for:
- source-specific discovery
- source-specific extraction
- normalization into shared item structure
- returning discovered items plus source-level diagnostics

### 3. Shared normalized item schema
All adapters must emit the same downstream-ready shape.

Required conceptual fields:
- `sourceType`
- `sourceUrl`
- `sourceName`
- `itemUrl`
- `canonicalUrl`
- `title`
- `publishedAt`
- `discoveredAt`
- `content`
- `summaryMaterial`
- `stableIdentity`
- `topicHints`
- `rawMetadata`

Optional metadata may include:
- `author`
- `channelName`
- `repoName`
- `paperId`
- `communityScore`
- `transcriptAvailable`
- `extractionMethod`

### 4. Source-agnostic downstream pipeline
Once normalized items exist, the rest of the daily digest should not care where they came from.

Shared downstream sequence:
1. merged item collection
2. dedupe
3. ledger suppression
4. topic inference
5. key-insight generation
6. rendering
7. email send
8. state update

This architecture keeps ingestion complexity at the adapter boundary and keeps digest logic consistent.

## Adapter Design

### FeedAdapter
Production behavior:
- fetch RSS / Atom / Podcast entries directly
- normalize entries into shared item schema
- preserve current feed strength as the baseline ingestion path

Expected maturity:
- highest-confidence source type
- should remain the reference implementation for stable item identity and timestamps

### WebpageAdapter
Production behavior:
- fetch landing pages / blog indexes / article collections
- detect feed links in HTML when present
- detect candidate article links when no feed exists
- fetch article pages where needed
- normalize article candidates into shared item schema

Key rules:
- canonical URL resolution is required
- item identity should use canonicalized URL-based identity where possible
- article extraction should separate discovery HTML from article-body extraction

Risks:
- inconsistent timestamps
- noisy link discovery
- content extraction variability

### YouTubeAdapter
Production behavior:
- discover videos from channel or feed-like sources
- resolve channel feeds where possible
- extract title, URL, publish time, and description metadata
- prefer transcript-derived summary material when available
- fall back to metadata + description when transcript is unavailable

Key rules:
- current hardcoded channel map is temporary, not the final architecture
- transcript support is preferred but not mandatory for first production integration
- stable identity should be video-based, not feed-entry-based

Risks:
- channel resolution gaps
- transcript availability inconsistency
- metadata-only summaries can be weaker

### GitHubAdapter
Production behavior:
- support releases first as the initial production slice
- normalize release entries into digest items
- preserve repo and release metadata in raw metadata

Later expansion candidates:
- selected changelog pages
- tagged release notes
- explicit docs/release update patterns

Risks:
- release-only coverage may underrepresent repo activity
- must avoid overpromising broader GitHub monitoring until implemented

### DocsAdapter
Production behavior:
- detect meaningful documentation updates, not generic page fetch churn
- operate with low-frequency or significance-aware scanning
- produce items only when changes are materially relevant

Key rules:
- docs sources are not daily newsfeeds by default
- adapter must have change-significance rules before broad production rollout

Risks:
- high noise if implemented naively
- weak timestamps and weak “what changed” signals on many docs sites

### CommunityAdapter
Production behavior:
- support listing-based discovery for sources like Hacker News / Reddit / similar community pages
- prefer reading linked destination content when accessible
- fall back to listing-derived summary only when necessary

Key rules:
- community items need separate metadata such as score, comments, rank, or source-post link where available
- adapter must avoid flooding digest with shallow list entries

Risks:
- high noise
- duplicate coverage if linked destination is already a separate source
- weak content when external linked pages are unavailable

### PapersAdapter
Production behavior:
- use abstracts and metadata first
- support recent listing and paper metadata pages
- expand deeper only when needed

Key rules:
- papers should behave like research updates, not generic webpage scraping
- abstract-based summarization is acceptable for initial production support

Risks:
- timestamp semantics differ from news/blog sources
- some paper sources provide only metadata and abstract-level content

## Support Status Model
The system must expose support truthfully.

Recommended support states:
- `production_supported`
- `partial_supported`
- `discoverable_only`
- `deferred`
- `broken`

Definitions:
- `production_supported`: source type can produce real digest items in daily production flow
- `partial_supported`: source works with known limitations that may reduce completeness or quality
- `discoverable_only`: source can be probed or counted but is not yet fully wired into the send path
- `deferred`: intentionally excluded until a later implementation wave
- `broken`: intended to work but currently failing

This prevents future confusion between “an adapter exists” and “the source really works in the email digest.”

## Data and Identity Design

### Stable identity
Stable identity is mandatory for cross-source dedupe and sent-ledger correctness.

Recommended identity priority:
1. explicit canonical URL if available
2. normalized item URL
3. source-specific stable ID
   - YouTube video ID
   - GitHub release URL / tag URL
   - paper identifier
4. fallback hashed composite of source URL + title + publishedAt

### Timestamp policy
Every normalized item should expose a best-known timestamp and its confidence level.

Conceptual fields:
- `publishedAt`
- `publishedAtConfidence` = `exact | inferred | weak | unknown`

Rules:
- feeds usually provide exact timestamps
- webpage/community/docs/papers may require inference
- items with unknown timestamps may still be usable, but their inclusion/window logic must be explicit

### Extraction provenance
Each item should record how it was obtained so debugging is possible.

Conceptual provenance fields:
- `adapterType`
- `discoveryMethod`
- `contentExtractionMethod`
- `transcriptUsed`
- `fallbackUsed`

## Daily Digest Integration
The existing `runDailyDigest()` flow should be updated so that:
- fixed cutoff window calculation remains unchanged
- source loading continues to respect enabled sources
- ingestion no longer directly assumes feed-only fetching
- all normalized items flow through shared dedupe / selection / enrichment / render logic

The digest job should become the orchestrator of one unified production ingestion flow, rather than a direct feed fetcher.

## Observability and Diagnostics
The system needs source-level observability suitable for mixed-source debugging.

Recommended runtime diagnostics:
- sources attempted by adapter type
- items discovered per source
- items normalized per source
- items dropped due to missing identity / timestamp / extraction failure
- dedupe count by reason
- ledger-suppressed count by reason
- send selection count by source type

Recommended artifacts:
- optional per-run ingestion summary in `data/output`
- optional production support report aligned with coverage states

## Rollout Strategy
Even though the target architecture covers all source types, implementation should still land in controlled waves.

### Wave 1 — unify production ingestion foundation
- define shared normalized ingestion schema
- create unified production dispatch path
- migrate feed, GitHub, YouTube, and webpage adapters into production ingestion contracts
- preserve current RSS stability

### Wave 2 — expand into docs, community, papers
- add production adapters for docs, community, and papers
- add significance/noise rules
- validate timestamp and identity behavior

### Wave 3 — tighten quality and transparency
- improve identity resolution
- improve timestamp inference
- improve extraction quality
- expose honest support-state reporting
- add source-level diagnostics and reporting

## Testing Strategy
The implementation must be test-led and cover both unit and integration behavior.

Required test categories:
- adapter dispatch by source type / strategy
- normalized item schema validity
- stable identity generation across source types
- timestamp confidence behavior
- mixed-source dedupe behavior
- ledger suppression across mixed source types
- non-feed item inclusion in real digest assembly
- regression coverage for existing feed behavior
- fixed daily cutoff behavior preserved after ingestion unification

Recommended integration tests:
- one run with mixed source fixtures producing feed/webpage/youtube/github items
- one run validating docs/community/papers partial support behavior
- one run validating fallback behavior when extraction is weak or timestamps are partial

## Risks
Highest-risk areas:
1. stable identity for non-feed items
2. timestamp quality for webpages/docs/community/papers
3. noisy discovery from generic webpages and community sources
4. uneven content extraction quality
5. ledger assumptions that currently align more naturally with feed items

## Recommended Decision
Adopt the unified production ingestion architecture and treat the existing adapter set as the starting point, but not as proof of production completeness.

The implementation should merge discovery and daily production into one real pipeline, prioritize correctness of identity/timestamp handling, and expose honest support states so source coverage matches what the user actually receives in email.
