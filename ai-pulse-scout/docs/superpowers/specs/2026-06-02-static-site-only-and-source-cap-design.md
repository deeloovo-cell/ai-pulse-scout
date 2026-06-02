# AI Pulse Scout: Static-site-only runtime and per-source cap design

Date: 2026-06-02
Branch: feature/ai-pulse-scout-mvp
Status: approved-in-chat (approach A), pending implementation

## Decision

Adopt a static-site-only daily runtime for the current AI Pulse Scout production flow.

- Daily scheduled job remains at 07:00 local time.
- The scheduled job publishes the static site only.
- Email sending is treated as disabled for the production path.
- Per-source item cap remains 10 and must be verified as part of the static-site pipeline behavior.

## Goals

1. Make the production behavior explicit: the system's main daily output is the static page, not email.
2. Preserve the existing 07:00 automated schedule already pointing at static-site publishing.
3. Keep source diversity under control by enforcing a maximum of 10 selected items per source before global ordering/rendering.
4. Reduce ambiguity in config/docs so future sessions do not assume email is still the primary path.

## Non-goals

1. Removing all email-related code tonight.
2. Re-architecting the pipeline.
3. Changing the current static-page global cap from 50.
4. Changing the current 24h window semantics.

## Chosen approach

Approach A (minimal production-alignment update):

- Keep the current launchd 07:00 schedule.
- Keep the schedule target as `scripts/publish-static-site.sh`.
- Update docs/config wording so production intent clearly says email is disabled and static publishing is the active delivery path.
- Verify the existing per-source cap of 10 is actually applied in the unified ingestion/static-site flow.
- Add/adjust tests where needed so this behavior is guarded.

## Why this approach

This matches the user's current operating mode with the smallest safe change. The schedule already exists and points to static publishing, so the main remaining work is to remove ambiguity and ensure the source-cap rule is explicitly verified.

## Implementation outline

### 1. Production intent clarification

Update the relevant docs/config comments to state:

- email delivery is currently disabled for production use,
- static page generation/publishing is the active daily output,
- the 07:00 schedule is for static publishing.

### 2. Source-cap verification

Inspect the unified ingestion path and confirm that each source is capped to 10 items before downstream ordering and rendering.

If the implementation is already correct, preserve it and strengthen tests/documentation.
If any path bypasses that cap, fix only that path.

### 3. Schedule verification

Keep the existing `launchd` job definition unchanged unless verification shows drift.
Expected state:

- label: `com.ai-pulse-scout.daily`
- time: 07:00 local
- program target: `scripts/publish-static-site.sh`

## Testing

Required verification:

1. Targeted tests covering per-source cap = 10.
2. Targeted tests covering static-site pipeline behavior still passing after wording/config updates.
3. Manual schedule verification via `launchctl list com.ai-pulse-scout.daily`.

## Risks

1. Documentation-only changes could still leave one stale comment or entrypoint implying email is primary.
2. The code may already enforce per-source cap correctly, but without an end-to-end guard future edits could accidentally bypass it.

## Acceptance criteria

1. Daily production flow is clearly documented as static-site-only.
2. Email is explicitly described as disabled/non-primary for production.
3. The 07:00 schedule remains installed and points to static publishing.
4. Per-source cap of 10 is verified by tests and/or focused runtime evidence.
5. Changes are committed and pushed to `feature/ai-pulse-scout-mvp`.
