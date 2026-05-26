# Enable All Registered Sources with Transparent Support Outcomes

## Summary

AI Pulse Scout currently has a unified multi-source ingestion architecture, but production digest runs still only enable a small live subset of registered sources. The user wants every registered source in `config/sources.yaml` enabled so production runs reflect the full stored source universe rather than the current 17-source RSS-heavy subset.

This change enables all registered sources directly in production while preserving honest reporting about actual support quality. It does **not** attempt to hide failures, rewrite ranking rules, or silently soften degraded source outcomes. The rollout goal is visibility first: let the real production behavior of the full source universe appear, then optimize based on observed results.

## Goals

- Enable all registered sources in `config/sources.yaml` for production runs.
- Preserve the existing fixed daily digest window anchored to `07:00 Asia/Shanghai`.
- Preserve existing dedupe, selection, and rendering behavior.
- Preserve honest support-state reporting for each source.
- Produce clear post-change verification data showing what the broader source universe actually contributes.

## Non-Goals

- No redesign of item selection/ranking.
- No dedupe logic changes.
- No renderer behavior changes.
- No attempt to suppress noisy or broken sources during this rollout.
- No per-domain custom extractor wave as part of this change.

## User Intent

The user explicitly wants the full stored source universe to participate in production instead of staying artificially limited to the previously enabled subset. The user chose the rollout mode equivalent to:

> Enable all registered sources while keeping failures/support limitations transparent.

That means the system should run all sources and report their actual outcomes rather than pretending all of them are production-grade.

## Current State

- The registry already contains many more sources than the currently enabled live subset.
- Unified ingestion and support-state reporting are already implemented.
- The webpage-quality phase is already complete.
- Many registered non-RSS sources remain disabled with deferred coverage status, so current production behavior still resembles the original RSS-heavy digest.

## Proposed Change

### 1. Source enablement

Set every registered source in `config/sources.yaml` to `enabled: true`.

This is the primary change. It moves the production digest from a restricted enabled subset to the full registered source universe.

### 2. Runtime behavior remains otherwise unchanged

The rollout intentionally leaves the following behaviors unchanged:

- daily collection windowing
- dedupe semantics
- item selection/sorting
- email rendering behavior
- support-state vocabulary

This isolation matters because it ensures any observed behavior shift can be attributed to broader source participation rather than bundled logic changes.

### 3. Transparent support outcomes

All sources should continue to surface their actual support states, including:

- `production_supported`
- `partial_supported`
- `discoverable_only`
- `deferred`
- `broken`

Enabling every source does **not** mean every source is expected to succeed. A mixed result set is an expected and useful rollout outcome.

## Expected Outcomes

After rollout, production runs are expected to show a broader and messier but more truthful ingestion picture:

- some newly enabled sources will contribute useful items,
- some will yield degraded items,
- some will discover URLs but fail to produce strong normalized items,
- some will fail entirely.

This is acceptable for the initial enable-all phase because the purpose is to expose real operational coverage rather than maintain the appearance of a fully production-hardened source universe.

## Data Flow / Operational Flow

1. Load all registered sources from `config/sources.yaml`.
2. Because all are enabled, all registered sources enter the production adapter pipeline.
3. Each source is processed by the existing adapter-selection logic.
4. Each source returns normal items plus diagnostics and a support state.
5. Existing dedupe, selection, and rendering logic operate unchanged on resulting items.
6. Existing coverage/support summaries reveal the new real distribution of source outcomes.

## Risks

### Risk 1: digest noise increases

More enabled sources may increase low-value, duplicate, or degraded items. This is acceptable in the short term because current selection and dedupe behavior remains the control surface and because the rollout is explicitly visibility-first.

### Risk 2: more broken sources appear

Newly enabled sources may increase reported failures. This is expected, not a regression in itself.

### Risk 3: user perceives enable-all as quality guarantee

Enabling all sources could be mistaken for certifying them as equally production-ready. To avoid that misunderstanding, rollout reporting must clearly distinguish source participation from source quality.

## Verification Plan

After enabling all registered sources, verify and report:

1. total enabled source count,
2. support-state distribution,
3. total fetched item count,
4. deduped item count,
5. final selected digest item count,
6. top contributing sources,
7. clearly failing or high-noise sources.

Verification should use existing project commands and should include at least one production-like run that exercises the broadened source set.

## Success Criteria

The change is successful if:

- every registered source is enabled in `config/sources.yaml`,
- production runs ingest the full registered source universe,
- support-state reporting remains honest,
- no permanent change is made to the established daily cutoff logic,
- verification output clearly shows the broadened source participation and outcome mix.

## Future Follow-Ups

After the enable-all rollout, likely next steps include:

- pruning or downgrading obviously poor sources,
- improving observability for noisy or broken sources,
- tightening selection behavior if degraded items crowd out better content,
- adding domain-specific hardening where broad adapters underperform.
