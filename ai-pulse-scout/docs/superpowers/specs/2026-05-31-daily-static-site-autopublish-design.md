# Daily Static Site Auto-Publish Design

## Goal

Make AI Pulse Scout automatically start around 07:00 Asia/Shanghai each day, generate the latest static site, and publish the updated site to `daily.deanlu.ai` so the user can open the site in the morning and see fresh content without manual redeploy steps.

## Current verified gap

The existing local scheduler is present as a launchd pattern, but it is not currently satisfying the website requirement:

- the launchd job is not loaded by default on the current machine state,
- the launchd job points to `scripts/send-daily.sh`,
- `scripts/send-daily.sh` invokes `src/cli/sendDaily.ts`, which is the email/digest-send path,
- the static-site publish path is therefore not scheduled.

Static site generation itself already exists through `npm run build:site`, and Vercel deployment already works when triggered with the correct project settings.

## Requirements

1. Around 07:00 Asia/Shanghai each day, the system must automatically start.
2. The automated run must build the latest static site using the existing Shanghai 07:00 digest-date semantics.
3. The automated run must trigger publication so `daily.deanlu.ai` updates without manual dashboard action.
4. The automation must have clear logs showing start, build success/failure, deploy trigger success/failure, and completion.
5. Local manual execution of the same automation entrypoint must be possible for verification and recovery.
6. Existing manual `npm run build:site` and `npm run site:export -- --date YYYY-MM-DD` flows must remain intact.
7. Existing email/digest-send code paths should not be broken, but the 07:00 website automation must no longer depend on the email-send script.

## Chosen approach

Use the existing macOS launchd scheduling pattern on the Mac mini, but repoint the daily 07:00 job to a dedicated static-site autopublish script.

That script will:

1. run the existing `build:site` command locally,
2. call a Vercel deploy hook URL stored in environment,
3. exit non-zero if either build or deploy-hook trigger fails,
4. write all activity to daily log files under `data/logs/`.

## Why this approach

This is the smallest reliable change because:

- the daily 07:00 local scheduling pattern already exists,
- static-site build behavior is already implemented and verified,
- Vercel already knows how to publish the site when triggered,
- the main missing link is wiring the schedule to the correct build-and-publish path.

A Vercel-native scheduler could also work, but that would require additional remote capability and configuration assumptions. The local-scheduler-first design minimizes unknowns and fits the user’s requirement of a morning automatic run on the existing machine.

## Design details

### 1. New autopublish CLI

Add a new CLI entrypoint dedicated to automated static-site publishing.

Responsibilities:
- log start/end,
- invoke the existing `build:site` behavior,
- validate presence of a `VERCEL_DEPLOY_HOOK_URL` environment variable,
- POST to the deploy hook URL after a successful build,
- print/log the deploy response summary,
- exit with failure if build or deploy trigger fails.

This keeps publish orchestration out of shell-only glue and makes the core behavior testable.

### 2. New launchd shell wrapper

Add a new shell wrapper for the 07:00 job.

Responsibilities:
- establish PATH for launchd,
- create `data/logs/`,
- redirect stdout/stderr to a daily log,
- call the new CLI.

This mirrors the existing operational style of `scripts/send-daily.sh` so the automation remains easy to inspect from logs.

### 3. Scheduler rewiring

Update the launchd plist so the daily 07:00 scheduled job calls the new static-site autopublish shell wrapper instead of `scripts/send-daily.sh`.

The schedule time remains unchanged:
- 07:00 host local time

This matches the existing fixed daily cutoff semantics and the user’s expectation that a shortly-after-7am completion is acceptable.

### 4. Environment contract

The automation requires one new environment variable:

- `VERCEL_DEPLOY_HOOK_URL`

If missing, the autopublish run must fail loudly in logs rather than silently succeeding after only local build.

This keeps failure mode explicit and operationally debuggable.

### 5. Logging

The daily shell wrapper will continue the established log style under `data/logs/`.

Expected log phases:
- daily static publish starting,
- node version / project path,
- static build start,
- static build success,
- deploy hook trigger start,
- deploy hook accepted/succeeded,
- done or error.

### 6. Manual verification path

The same autopublish CLI/script must be manually runnable so we can verify the exact production path without waiting until the next morning.

## Files to add or modify

### Create
- `src/cli/publishStaticSite.ts`
- `scripts/publish-static-site.sh`
- `tests/cli/publishStaticSite.test.ts`
- `docs/superpowers/plans/2026-05-31-daily-static-site-autopublish-implementation.md`

### Modify
- `package.json`
- `scripts/com.ai-pulse-scout.daily.plist`
- `scripts/install-schedule.sh`
- `README.md`

## Test strategy

1. Add a focused CLI test for missing deploy hook env.
2. Add a focused CLI test for successful deploy-hook POST after successful build delegation.
3. Manually run the autopublish command with environment set.
4. Reinstall or reload the launchd schedule and verify it is loaded.
5. Trigger one manual production-path run and confirm the site updates through the normal deployment channel.

## Non-goals

- replacing Vercel hosting,
- changing the existing `build:site` digest-date semantics,
- redesigning the digest selection pipeline,
- debugging incomplete website content in this task unless it blocks successful daily autopublish.
