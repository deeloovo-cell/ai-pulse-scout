# Real score threshold for static digest and page match

## Goal
Make the static digest use a real backend relevance score instead of a presentation-only match number.

## Confirmed user intent
- The static page should use方案一: show the real score as `match %`.
- Items below a threshold should not enter the digest list.
- The threshold is temporarily `0.6`.
- The assistant should verify how many items remain under that threshold after the score path is correctly wired.

## Current problem
The current static-site flow does not provide a trustworthy backend score for digest selection:
- adapters/normalizers initialize `relevance_scores.overall` to `0`
- `enrichSingleItem(...)` enriches insight text but does not compute or persist a real score
- static page `match %` is currently produced by `computeDisplayMatch(...)`, which is a presentation-layer value and can synthesize percentages from item position

Because of this, current page-visible match values do not correspond to a real selection score, and threshold filtering on `relevance_scores.overall` is not yet meaningful.

## Design decision
Use one real score path for both selection and display.

### Score source
- `NormalizedItem.relevance_scores.overall` becomes the single canonical score for digest inclusion and static-page display.
- The implementation must populate this field in the static digest pipeline before selection/rendering.

### Selection rule
- `selectItems(...)` should include only items with `relevance_scores.overall >= 0.6`.
- `decision_reason` should explicitly describe threshold inclusion.
- Items below threshold are excluded from the final digest list.

### Static-page display rule
- Static-page `match %` should render directly from the real `relevance_scores.overall` value.
- Remove synthetic rank-position fallback percentages from the static page.
- If a real score is unavailable for an item, the renderer should not fabricate a percentage. The preferred behavior is to display no match pill rather than a fake score.

### Verification requirements
Before claiming completion:
1. Add failing tests for the real-score threshold behavior.
2. Add/adjust tests to prove static-page `match %` reads from the real score and does not fabricate a value when score is unavailable.
3. Run focused test suites covering selection and static-page rendering.
4. Re-export `2026-05-31` and report real counts:
   - total items after dedupe
   - items with score `>= 0.6`
   - items with score `< 0.6`
   - final digest item count
5. If the user wants it live immediately, selectively commit/push only the intended score/threshold changes and republish.

## Scope
In scope:
- score wiring in the static digest pipeline
- threshold-based digest selection at `0.6`
- static page `match %` parity with the real score
- tests and export verification

Out of scope:
- changing email subject naming
- changing review page naming
- redesigning score semantics beyond what is necessary to make `overall` real and usable in the current digest flow

## Open implementation note
The exact place where the real score should be computed must follow existing pipeline structure, but the outcome must be that `relevance_scores.overall` is populated before `selectItems(...)` and `renderStaticSite(...)` rely on it.
