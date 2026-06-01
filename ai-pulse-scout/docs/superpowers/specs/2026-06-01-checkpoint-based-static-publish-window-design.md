# Checkpoint-based static publish window design

Date: 2026-06-01
Project: AI Pulse Scout

## Goal

Replace the current fixed daily publish window (`[previous day 07:00, current day 07:00)`) with a rolling checkpoint-based window so each run ingests items published between the previous successful run and the current run start.

## Approved decisions

- Window end uses the current run start time, not the current run completion time.
- On first run with no checkpoint, default the window start to 24 hours before the current run start.
- A checkpoint advances only after a full successful publish flow completes.
- The scheduled trigger time remains 07:00 Asia/Shanghai; it is a job trigger only, not a logical window boundary.

## Desired semantics

For each publish run:

1. Capture `runStartedAt` once, at the beginning of the publish flow.
2. Resolve `windowStart`:
   - If a previous successful checkpoint exists, use that timestamp.
   - Otherwise use `runStartedAt - 24h`.
3. Set `windowEnd = runStartedAt`.
4. Ingest using the half-open interval `[windowStart, windowEnd)`.
5. If build + deploy both succeed, write a new checkpoint recording the current run completion timestamp.
6. If any step fails, do not advance the checkpoint.

## Data model

Add a small checkpoint state file under project-controlled runtime data, for example:

- `data/state/static-site-publish-checkpoint.json`

Proposed payload:

```json
{
  "lastSuccessfulFetchCompletedAt": "2026-06-01T07:32:18.000+08:00",
  "lastRunStartedAt": "2026-06-01T07:00:03.000+08:00",
  "updatedAt": "2026-06-01T07:32:18.000+08:00"
}
```

Minimum required field is:

- `lastSuccessfulFetchCompletedAt`

Optional metadata may be stored for observability, but ingestion logic should depend only on the successful checkpoint timestamp.

## Runtime flow

### Happy path

1. `publish-static-site.sh` starts.
2. Capture `runStartedAt` once.
3. Resolve effective ingest window from checkpoint state.
4. Run the local static-site build using that window.
5. Deploy generated static output to Vercel static project.
6. After successful deploy, write the new checkpoint with the completion time.

### Failure path

If build fails or deploy fails:

- exit non-zero
- preserve the previous checkpoint unchanged
- log the attempted run window for debugging

## Component changes

### 1. Window resolution utility

Introduce a focused utility that:

- reads checkpoint state
- validates/parses timestamps
- computes `{ windowStart, windowEnd, runStartedAt }`
- falls back to `runStartedAt - 24h` when checkpoint is absent or invalid

### 2. Publish CLI / shell flow

Update the publish entrypoint so one run owns:

- `runStartedAt`
- computed ingest window
- checkpoint update on success

This prevents different phases from computing different effective windows.

### 3. Static site build entrypoint

Ensure the build step can accept an explicit window override rather than recomputing the old digest-date-based 07:00 boundary internally.

### 4. Logging

Every publish run should log at minimum:

- `runStartedAt`
- `windowStart`
- `windowEnd`
- checkpoint source (`previous checkpoint` vs `first-run fallback`)
- new checkpoint written on success

## Error handling

- Missing checkpoint file: treat as first run fallback.
- Malformed checkpoint file: log warning and fall back to 24h window.
- Partial publish failure: do not write checkpoint.
- Concurrent runs: out of scope for now, but implementation should avoid writing checkpoint before deploy success.

## Testing requirements

Add focused tests for:

1. Existing checkpoint present:
   - returns checkpoint as `windowStart`
   - returns provided `runStartedAt` as `windowEnd`
2. No checkpoint:
   - returns `runStartedAt - 24h`
3. Invalid checkpoint:
   - falls back to `runStartedAt - 24h`
4. Successful publish:
   - checkpoint file advances
5. Failed publish:
   - checkpoint file does not advance
6. Interval semantics:
   - items at `windowStart` are included
   - items at `windowEnd` are excluded

## Trade-offs

### Why use run start as window end

This keeps the ingest window deterministic for a given scheduled run. Items appearing while the job is still processing will be picked up next run instead of unpredictably leaking into the current one.

### Why checkpoint on completion

This prevents data loss. A failed run must not advance the lower bound, or items could be skipped permanently.

## Out of scope

- Changing the 07:00 launchd trigger time
- Multi-run locking / distributed coordination
- Re-labeling digest pages away from the current date-based naming scheme unless required by implementation details

## Success criteria

After implementation:

- daily publish no longer depends on a fixed `[D-1 07:00, D 07:00)` logical window
- each successful run ingests from the prior successful completion checkpoint to the new run start
- checkpoints survive across sessions/reboots
- a failed run does not cause a permanent ingestion gap
