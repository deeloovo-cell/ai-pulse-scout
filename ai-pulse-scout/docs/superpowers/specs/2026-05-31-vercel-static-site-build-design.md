# Vercel Static Site Build Design

Date: 2026-05-31

## Goal

Make AI Pulse Scout’s static-site export deployable on Vercel without manual date input, while preserving the existing manual historical export workflow.

## Current Problem

Vercel is currently configured with:
- Build Command: `npm run build`
- Output Directory: `public`

But in the repo:
- `npm run build` only runs `tsc`
- the real static-site generator is `npm run site:export`
- the real output directory is `data/output/site`
- `site:export` currently requires `--date YYYY-MM-DD`

So Vercel is neither running the correct export step nor pointing at the correct artifact directory.

## Constraints

- Keep Vercel’s production branch wiring on `feature/ai-pulse-scout-mvp` unchanged.
- Preserve `npm run site:export -- --date YYYY-MM-DD` for manual historical export.
- Reuse the current Shanghai/cutoff semantics already used by the static export flow.
- Keep the deployment entrypoint non-interactive and no-argument so Vercel can run it automatically.

## Options Considered

### Option 1 — Replace `build` with static export
Change `npm run build` itself to run static export.

**Pros**
- minimal Vercel settings change

**Cons**
- overloads `build` with deployment-specific semantics
- can surprise local workflows that expect `build` to stay TypeScript compilation
- makes it harder to preserve separate manual export and compile behaviors cleanly

### Option 2 — Add a dedicated no-arg deployment build command (recommended)
Add a new script such as `npm run build:site` that computes the target digest date automatically, calls the existing static export flow, and writes to `data/output/site`.

**Pros**
- explicit deployment semantics
- preserves existing `build` and `site:export` behavior
- clean fit for Vercel’s Build Command model

**Cons**
- adds one extra script/CLI path

### Option 3 — Hardcode a date inside Vercel Build Command
Use something ad hoc in Vercel to pass a date into `site:export`.

**Pros**
- no code changes initially

**Cons**
- brittle and environment-dependent
- hides deployment logic in Vercel settings instead of the repo
- poor repeatability and maintainability

## Recommended Design

Use Option 2.

Add a deployment-oriented CLI entrypoint that:
1. computes the digest target date automatically using the existing daily cutoff semantics
2. delegates to the current static export flow
3. writes site artifacts to `data/output/site`
4. requires no arguments

Expose this through a new npm script:
- `build:site`

## Date Selection Rule

The deployment build must select the digest date that corresponds to the existing Asia/Shanghai 07:00 daily cutoff behavior.

Rule:
- derive the current digest window using the same cutoff logic already used by the project
- use that window’s end timestamp as the digest date label in `YYYY-MM-DD` form

This preserves consistency between manual date-based export and automatic deployment export.

## Components

### 1. Static export CLI helper expansion
Extend the static export helper module so it can compute the automatic deployment target date in addition to the existing date-based window calculation and default output directory.

### 2. Deployment CLI entrypoint
Add a new CLI file dedicated to no-arg site builds for deployment. It should:
- compute the automatic target date
- invoke the same export pipeline currently used by `site:export`
- log the chosen date and output paths
- fail clearly if export fails

### 3. Script wiring
Add a new npm script:
- `build:site`

## Testing Requirements

Implementation must verify:
1. automatic target-date calculation respects the Shanghai cutoff rule
2. the new deployment CLI succeeds without arguments
3. the deployment CLI writes to `data/output/site`
4. existing `site:export -- --date ...` behavior remains intact

## Final Vercel Settings

After implementation, the intended Vercel configuration is:
- Build Command: `npm run build:site`
- Output Directory: `data/output/site`

## Non-Goals

Out of scope:
- changing Vercel production branch selection
- redesigning the static-site HTML structure
- changing the manual historical export CLI contract
- adding new deploy transports beyond Vercel static output

## Success Criteria

This design is successful when:
- a no-argument repo command can build the static site for deployment
- the command emits artifacts under `data/output/site`
- Vercel can be pointed at that command and output directory without requiring manual date input
- existing manual exports by explicit date still work
