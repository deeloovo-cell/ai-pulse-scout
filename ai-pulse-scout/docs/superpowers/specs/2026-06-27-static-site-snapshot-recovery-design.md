# Static Site Snapshot Recovery Design

Date: 2026-06-27

## Problem

`site:export` can now recover enough upstream volume to reach `selected = 100`, but the full end-to-end static export path is unstable in the current environment because long-running runs are repeatedly terminated by `SIGKILL` before the final HTML is written.

This leaves us with a validated selection result but no reliable way to regenerate `data/output/site/index.html` from that selected set without re-running the entire ingestion pipeline.

## Goal

Add a minimal recovery path for static site generation so that once `selected` items are available, the final HTML page can be rendered and re-rendered without re-running ingestion.

## Non-goals

- Do not redesign the ingestion pipeline.
- Do not change the relevance-gate behavior in this pass.
- Do not add a database-backed snapshot system.
- Do not replace the normal `site:export` path; only add a recoverable side path.

## Recommended approach

Approach A: add a selected-items snapshot plus a render-from-snapshot path.

This is the smallest change that directly addresses the current failure mode.

## Alternatives considered

### B. Always split static export into two phases internally

Pros:
- Fully recoverable by default.

Cons:
- Bigger behavior change.
- More moving parts in the default path.
- Harder to validate quickly.

### C. One-off recovery script only

Pros:
- Very small short-term blast radius.

Cons:
- Leaves tool debt.
- Not reusable the next time a long export is interrupted.

## Design

### 1. Snapshot format

Persist the post-selection `NormalizedItem[]` array as JSON.

Suggested path:
- `data/output/site/selected-<digest-date>.json`

The file stores exactly the selected items that would otherwise flow into enrichment and final rendering.

### 2. Snapshot writer

During normal `src/cli/exportStaticSite.ts` execution:
- after `prepareDigestItems(...).selected` is computed
- write the selected array to the snapshot path
- continue with enrichment, relevance gate, and HTML export as before

This means an interrupted run can still leave behind a recoverable selected snapshot.

### 3. Snapshot reader / render path

Add a new CLI path that renders the static page from an existing snapshot.

Recommended implementation:
- new CLI: `src/cli/renderStaticSiteFromSnapshot.ts`

Behavior:
- input: `--date YYYY-MM-DD`
- optional: `--snapshot <path>`
- default snapshot path resolves to `data/output/site/selected-<date>.json`
- load items from JSON
- optionally run enrichment + relevance gate, or render directly from snapshot depending on what the snapshot contains
- write `data/output/site/index.html`

### 4. Snapshot contents choice

To keep this pass minimal, the snapshot should store selected `NormalizedItem[]` before enrichment.

Why:
- this matches the already-validated `selected = 100` checkpoint
- it preserves the exact boundary we need for recovery
- it avoids mixing two different snapshot semantics in one file

### 5. Recovery behavior

Expected recovery flow:
1. Run `site:export` until it reaches selected snapshot creation.
2. If the full run dies later, use the snapshot render CLI.
3. Regenerate final `index.html` from the saved selected set.

## Error handling

- Missing snapshot file → fail with a clear message naming the expected path.
- Invalid JSON → fail with a clear parse error.
- Empty snapshot → render empty page or fail explicitly; prefer explicit failure for recovery mode because an empty snapshot usually indicates wrong inputs.

## Testing

Add targeted tests for:
- snapshot path resolution
- write selected snapshot
- render from snapshot with a small fixture list
- final rendered HTML contains the same number of `digest-card` entries as the snapshot item count

## Success criteria

- A selected snapshot can be produced during normal static export.
- A separate render-from-snapshot path can regenerate `data/output/site/index.html` without re-running ingestion.
- The regenerated page’s item count matches the snapshot item count.
- Existing static export tests continue to pass.
