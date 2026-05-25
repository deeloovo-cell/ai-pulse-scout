# AI Pulse Scout — Multi-Source Ingestion & Topic-Grouped Digest Design

**Date**: 2026-05-25  
**Branch**: `feature/ai-pulse-scout-mvp`

## Goal
Expand AI Pulse Scout from a feed-centric pipeline into a multi-source ingestion pipeline that can process the current 123 configured URLs across multiple ingestion methods, while keeping a consistent digest output format and grouping digest items by topic.

## Confirmed Requirements

### Source handling
- The current `config/source-inbox.md` list remains the source inventory and should be normalized into structured sections.
- `config/source-inbox.md` becomes the structured source of truth.
- Source categories:
  - `rss`
  - `webpage`
  - `youtube`
  - `community`
  - `docs`
  - `papers`
- All configured URLs should be preserved during restructuring unless the user explicitly approves removal.

### Ingestion behavior
- Split the 123 URLs by ingestion method.
- Use category-specific reading strategies:
  - RSS → poll feed items directly
  - webpage/blog → fetch page, extract article links/content
  - YouTube → channel/video feed or transcript workflow
  - Reddit/HN → use listing pages carefully
  - docs/reference → low-frequency scan, not daily news-style by default
  - papers → recent listing + metadata extraction
- Hybrid handling policy is enabled:
  - content-rich items can flow normally into the main digest
  - weaker/listing-derived items may still be processed and included when they are meaningful enough to summarize
- There is **no ranking gate** for inclusion. If a source yields a new item, it should be processed.
- If one source yields multiple new items, all of them should be processed.

### Digest behavior
- The digest should keep the same output shape across all source types.
- Each digest item should include:
  - title
  - `Key Insights` (200–500 words)
  - source link
- Digest presentation should be grouped by topic, not by ingestion method.
- All processed new items may be included; inclusion is not capped per source.

## Proposed Topic Taxonomy
Each item gets one primary topic for display, with optional internal secondary tags.

1. **Frontier Model Labs**
2. **AI Developer Tools & Agents**
3. **Research & Papers**
4. **Robotics & Embodied AI**
5. **Industrial / Manufacturing AI**
6. **AI Products & Platforms**
7. **Community & Market Signals**
8. **AI News Roundup**

## Architecture

### 1. Structured source inventory
`config/source-inbox.md` is converted from a flat list into sectioned source categories:

```md
## rss
- ...

## webpage
- ...

## youtube
- ...

## community
- ...

## docs
- ...

## papers
- ...
```

This file becomes the canonical source-of-truth input for runtime parsing.

### 2. Category-first ingestion
The runtime parser reads structured sections and dispatches each source to a category-specific reader.

Reader categories:
- RSS reader
- webpage/article reader
- YouTube reader
- community reader
- docs/reference reader
- papers reader

Each reader is responsible for discovering candidate items and extracting enough content/metadata for downstream normalization.

### 3. Normalized item schema
All readers emit a common intermediate item structure, conceptually containing:
- source category
- source URL
- item title
- item URL
- publication timestamp if available
- extracted content and/or summary material
- metadata fields relevant to the source type
- inferred primary topic
- optional secondary tags

This normalized structure keeps downstream digest logic source-agnostic.

### 4. Topic-first digest assembly
After ingestion and normalization:
- all new items are collected
- each item is assigned one primary topic
- digest output is grouped by topic
- each item renders using the same output contract:
  - title
  - Key Insights (200–500 words)
  - source link

## Category-Specific Behavior

### RSS
- Poll feed items directly.
- Treat feed entries as candidate items.
- Extract linked article content when needed to improve summary quality.

### Webpage
- Fetch landing pages or blog indexes.
- Detect candidate article links.
- Read article pages to extract full content when possible.

### YouTube
- Support channel/video ingestion via feed-like discovery or page-based discovery.
- Prefer transcript-like extraction when available.
- Fall back to metadata + description-based summaries if transcripts are not available.

### Community
- Support Reddit and Hacker News style listing pages.
- Use listing pages for discovery.
- Prefer summarizing the linked destination content when accessible.
- Fall back to meaningful listing-derived summaries when necessary.

### Docs
- Treat docs/reference sources as lower-frequency update surfaces.
- Detect meaningful updates rather than scraping them like news homepages.
- Summaries should focus on what changed or what is newly relevant.

### Papers
- Use recent paper listings and metadata pages.
- Prefer abstracts and paper metadata for initial processing.
- Expand into deeper content only when available and necessary.

## Multi-Agent Execution Plan
Implementation should use six subagents in two waves.

### Wave 1: design/config parallel work
1. **source-taxonomy**
   - classify all URLs into the six source categories
   - propose the normalized `source-inbox.md`
2. **ingestion-design**
   - define category → reader behavior contracts
3. **topic-mapping**
   - define item → topic heuristics and fallback rules
4. **digest-normalization**
   - define consistent digest item rendering rules

### Wave 2: build and verify
5. **pipeline-implementation**
   - apply config and code changes
   - parse structured source sections
   - dispatch by category
   - process all new items
   - remove ranking as an inclusion gate
   - preserve topic-grouped digest output
6. **verification**
   - verify config parsing
   - verify ingestion dispatch
   - verify multi-item handling
   - verify topic-grouped digest output

## Progress Visibility
When subagents are running, progress should be reported in a named progress board format using the subagent labels above, with milestone updates after Wave 1 and Wave 2.

## Files Expected to Change
- `config/source-inbox.md`
- source parsing/config loading code
- ingestion dispatch logic
- reader-specific ingestion modules or branches
- topic classification logic
- digest assembly/rendering logic
- tests and/or dry-run verification paths

## Non-Goals
- Removing sources without explicit user approval
- Adding ranking-based inclusion gates
- Imposing per-source caps on new-item processing
- Changing the digest item output away from `Key Insights (200–500 words) + source link`

## Risks / Notes
- Some sources will only provide partial or listing-derived content.
- Topic inference will need clear fallback behavior to avoid unstable grouping.
- Docs and community sources may need more conservative update detection to avoid noisy digests.
- The source file restructuring must preserve all current URLs.

## Recommendation
Implement a category-first ingestion pipeline with topic-first digest presentation, using the structured `source-inbox.md` file as the canonical configuration input.
