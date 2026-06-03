# Single-page static site design

Date: 2026-06-04
Branch: `feature/ai-pulse-scout-mvp`

## Goal

Change AI Pulse Scout static publishing from a recent-days archive site into a single-page daily site:

- keep only `index.html` as the public page for `https://daily.deanlu.ai/`
- remove the entire "最近 7 天" navigation section
- stop generating and serving `days/YYYY-MM-DD.html` archive pages
- ensure previously generated `days/*.html` files are removed from the deployed artifact

## Scope

In scope:

- static rendering/output changes only
- static export cleanup of old archive files
- test updates for the new single-page behavior
- production deploy verification on `daily.deanlu.ai`

Out of scope:

- changing item selection or scoring logic
- changing ingestion windows
- changing deployment platform
- adding redirects or replacement archive UX

## User-approved behavior

1. `daily.deanlu.ai` should continue to resolve to the homepage (`index.html`).
2. The homepage should show only the current generated daily digest content.
3. The "最近 7 天" block should be removed entirely.
4. Archive pages under `days/` should no longer be generated.
5. Existing `days/*.html` files should be deleted from the exported/deployed artifact so old archive URLs stop working.

## Design

### 1. Rendering

- Remove recent-days navigation rendering from the static shell.
- Keep the current digest-card content layout for the homepage.
- Homepage remains the only rendered HTML page.

### 2. Export behavior

- `exportStaticSite()` writes only `index.html`.
- `exportStaticSite()` removes the `days/` directory or all `days/*.html` files during export.
- Return type can be simplified to only the homepage output path if the callsites/tests permit; otherwise keep compatibility with a harmless placeholder only if needed temporarily.

### 3. CLI behavior

- `src/cli/exportStaticSite.ts` no longer needs recent-days resolution for rendering.
- Any archive-window navigation helpers that are only used for recent-days navigation should be removed or left unused only if keeping them is temporarily lower-risk.

### 4. Testing

Update tests to verify:

- homepage renders without "最近 7 天"
- export writes `index.html`
- export removes old `days/*.html`
- no archive page output is required anymore
- old tests asserting archive navigation/history behavior are removed or replaced

## Recommended implementation order

1. Update rendering helpers to support homepage-only output.
2. Update export logic to stop writing day pages and clear `days/` artifacts.
3. Remove/archive recent-days-specific test expectations.
4. Run targeted static-site test suite.
5. Deploy and verify:
   - homepage loads
   - homepage has no "最近 7 天"
   - a former archive URL under `/days/...` no longer works

## Risks

- Some tests and callsites still assume `dayPath` exists.
- Deployment may appear unchanged if stale `days/` assets remain in the build artifact.
- Vercel alias switching may lag after deploy, so verification must check the actual active production deployment and the live domain.

## Acceptance criteria

- `https://daily.deanlu.ai/` loads and shows current digest content
- page source contains no "最近 7 天" section
- no `days/YYYY-MM-DD.html` page is generated in the local export artifact
- deployed site no longer serves old archive pages
