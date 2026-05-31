# AI Pulse Scout Static Site Export Design

Date: 2026-05-31

## Goal

Generate a local static website artifact from AI Pulse Scout digest output so the Mac mini can run the pipeline locally and produce publishable HTML files for `daily.deanlu.ai` later.

The immediate goal is only local artifact generation.

## User Decisions Already Made

- The long-term delivery surface should be a static website, not the interactive Phase 2 review app.
- DeepSeek enrichment runs only on the Mac mini, so content generation must happen locally.
- The website shape should be:
  - homepage showing current day content
  - recent 7 days list on the homepage
  - archive pages stored as separate HTML files under `/days/YYYY-MM-DD.html`
- Publishing transport is out of scope for now.
- For this first test, use **2026-05-30** as the target date.
- The preferred implementation path is to **rerun the 2026-05-30 pipeline and then generate the static page**, because that matches the intended future daily flow better than wrapping an already-generated HTML artifact.

## Recommended Approach

### Option 1 — Add a minimal static export layer after pipeline output (recommended)
- Reuse the existing pipeline as the source of truth for final digest items.
- Add a small renderer/export step that writes:
  - `site/index.html`
  - `site/days/2026-05-30.html`
- Use the same final digest content for both pages, with the homepage also rendering a recent-days list.

**Why this is recommended:**
- follows the future daily operating model
- keeps the current pipeline authoritative
- avoids inventing a second content path
- produces clean website-shaped artifacts rather than email-shell hacks

### Option 2 — Wrap existing digest HTML into a site shell
- Faster, but website output stays email-shaped and becomes a transitional hack.

### Option 3 — Generate only one standalone daily HTML page
- Fastest, but does not match the agreed homepage + archive shape.

## Approved Design

The system should add a **minimal static-site export path** that runs after the digest pipeline for a target day.

For the first test run:
- rerun the 2026-05-30 digest pipeline locally
- use its final digest item set as the website content source
- generate a local site artifact with:
  - `site/index.html`
  - `site/days/2026-05-30.html`

## Architecture

### Current state

The project already has:
- a digest pipeline that produces final selected items
- HTML email rendering
- a review website path that is now not the chosen delivery surface

### New state

Add a new export path:

`pipeline -> final digest items -> static site renderer -> site files`

This path must:
- reuse the existing pipeline/final item selection
- avoid depending on the interactive review server
- avoid introducing publish transport logic yet

### Components

#### 1. Static site renderer
A new focused renderer should generate website HTML, not email HTML.

Responsibilities:
- render a readable homepage shell
- render a daily archive page shell
- render digest items in a clean web layout
- render recent-days navigation

#### 2. Static site exporter
A small export function should:
- accept target date and final digest items
- create `site/` and `site/days/`
- write archive page for the target day
- write homepage for the current exported day

#### 3. CLI entrypoint
A dedicated CLI should:
- accept a target date such as `2026-05-30`
- rerun pipeline/backfill-style logic for that day
- feed final items into the static exporter
- print output paths for inspection

## Output Shape

### Homepage: `site/index.html`
Must include:
- site title
- target date label
- current day digest content
- recent 7 days list
- for this first test, the recent-days list can contain only `2026-05-30`

### Archive page: `site/days/2026-05-30.html`
Must include:
- page title/date
- same digest body as homepage
- link back to homepage

## Data Rules

- Final digest item membership must still come from the existing digest pipeline.
- This feature must not create a second item-selection system.
- Static site output should reflect the final digest items for the chosen day.

## Error Handling

- If the target-day pipeline yields zero final items, do not fake content.
- Export may still write a valid empty-state page if needed, but should report the zero-item outcome clearly.
- If export fails after the pipeline succeeds, the failure should be reported without pretending files were created.

## Testing Requirements

Implementation should verify:

1. static export writes both homepage and day page
2. homepage includes the recent-days list
3. archive page includes a homepage backlink
4. rendered pages contain digest item titles and links
5. target date appears in output
6. empty item sets render a valid empty state

## Non-Goals

Out of scope for this phase:
- actual publish/deploy transport to `daily.deanlu.ai`
- interactive rating/follow-up persistence
- review APIs/server usage as the primary surface
- filling a true 7-day archive from history on day one
- writeback/sync mechanisms

## Success Criteria

This design is successful when a local run can produce:
- a readable `site/index.html`
- a readable `site/days/2026-05-30.html`
- homepage recent-days navigation scaffolding
- content sourced from the rerun pipeline rather than a manual copy step
