# Phase 1 Feed Adapter Design

**Scope:** Implement the first real readability adapter family for AI Pulse Scout source-universe coverage: RSS, Atom, and podcast feeds.

## Goal
Convert feed-capable URLs from purely classified/unverified coverage entries into real checked results based on actual network fetch behavior.

## Design
Phase 1 introduces a feed adapter that reuses the existing RSS parser stack to test whether a source is readable now. For each source classified as `rss_parser` or `podcast_feed`, the coverage run will attempt a real fetch and map the result into a more honest status model.

## Status model for Phase 1
- `success` — feed fetched and at least one item discovered in the check window
- `empty` — feed fetched successfully but no items were discovered in the check window
- `failed` — feed adapter exists but the fetch failed
- `remove` — source is explicitly non-traversable / should be pruned

Non-feed sources without adapters remain temporarily classified by baseline logic until later phases add more adapters.

## Architecture changes
1. Add a formal adapter interface in `src/adapters/types.ts`
2. Add `src/adapters/feedAdapter.ts`
3. Reuse `fetchRssSource()` from `src/fetchers/rssFetcher.ts`
4. Update `runSourceCoverage()` to dispatch feed-capable sources through the real adapter
5. Update tests so coverage reflects actual feed-backed readability behavior

## Notes
- This phase is intentionally narrow: it does not yet solve YouTube, GitHub, or generic webpage discovery.
- The point is to make the 123-source report partially real instead of purely theoretical.
