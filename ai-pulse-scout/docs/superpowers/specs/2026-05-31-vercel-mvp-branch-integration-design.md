# Vercel MVP Branch Integration Design

**Date:** 2026-05-31

## Goal

Safely land the arXiv static-export fallback change that currently lives on `feature/ai-pulse-scout-static-site` into the branch Vercel is already serving, `feature/ai-pulse-scout-mvp`, so `daily.deanlu.ai` can pick up the change without changing the configured production branch.

## Current State

- Vercel is currently serving `feature/ai-pulse-scout-mvp`.
- The new change was committed and pushed on `feature/ai-pulse-scout-static-site` as commit `7a7cfd8` (`feat: add arxiv latest-batch fallback for static export`).
- The target repo is `deeloovo-cell/ai-pulse-scout`.
- The desired deployment path is to keep the existing Vercel project/branch wiring stable and update the served branch contents.

## Recommended Approach

### Primary path: cherry-pick the single validated commit

Apply commit `7a7cfd8` onto `feature/ai-pulse-scout-mvp` with `git cherry-pick`.

Why this is preferred:
- It carries the smallest reviewed change set.
- It avoids pulling unrelated branch history from `feature/ai-pulse-scout-static-site`.
- It keeps the currently served branch model unchanged for Vercel.
- It makes rollback simpler if deployment behaves unexpectedly.

### Fallback path: merge the branch

If cherry-pick conflicts badly or proves incomplete because the commit depends on other history not present on `feature/ai-pulse-scout-mvp`, fall back to merging `feature/ai-pulse-scout-static-site` into `feature/ai-pulse-scout-mvp`.

Use this only if the single-commit path is not viable.

## Execution Sequence

1. Check out `feature/ai-pulse-scout-mvp` in a safe local worktree/repo state.
2. Attempt `git cherry-pick 7a7cfd8`.
3. If conflicts occur:
   - inspect conflict scope;
   - stop and report if the resolution is nontrivial;
   - only proceed to branch merge if the single-commit path is clearly unsuitable.
4. Run focused verification covering the touched behavior:
   - `tests/adapters/arxivApi.test.ts`
   - `tests/adapters/feedAdapter.test.ts`
   - `tests/static/exportStaticSite.test.ts`
   - `tests/static/exportStaticSiteCli.test.ts`
   - `tests/static/renderStaticSite.test.ts`
5. If verification passes, push `feature/ai-pulse-scout-mvp`.
6. Trigger or observe Vercel redeploy for the existing production branch.
7. Validate the live site/output after deployment.

## Success Criteria

The operation is successful when all of the following are true:
- `feature/ai-pulse-scout-mvp` contains the arXiv latest-batch fallback change.
- Focused verification passes on the served branch after integration.
- Vercel can redeploy from the unchanged production branch wiring.
- `daily.deanlu.ai` can serve a build that includes the new static export behavior.

## Risk Notes

- The `feature/ai-pulse-scout-mvp` branch may differ from the static-site branch enough that cherry-pick could conflict.
- A passing local test run does not guarantee Vercel runtime behavior; deployment still needs post-deploy validation.
- If Vercel’s build command or output directory are already wired to old assumptions, branch integration alone may not be sufficient; that becomes a separate deployment-config issue.

## Out of Scope

- Changing Vercel production-branch settings.
- Reworking the deployment architecture.
- Broad refactoring unrelated to the arXiv fallback and static export path.
