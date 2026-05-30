# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---
## [LRN-20260530-001] correction

**Logged**: 2026-05-30T17:25:00+08:00
**Priority**: high
**Status**: pending
**Area**: config

### Summary
AI Pulse Scout source configuration must keep `config/sources.yaml` aligned with `config/source-inbox.md`.

### Details
I incorrectly explained the NVIDIA article as expected because `runDailyDigest` reads `config/sources.yaml`, but the user clarified an existing project rule: `sources.yaml` should stay consistent with `source-inbox.md`. The real issue is configuration drift, not just current runtime behavior.

### Suggested Action
Add or restore a synchronization path so `sources.yaml` matches `source-inbox.md`, then ensure the digest pipeline consumes the synchronized source set.

### Metadata
- Source: user_feedback
- Related Files: config/sources.yaml, config/source-inbox.md, src/jobs/runDailyDigest.ts
- Tags: config-drift, source-selection, ai-pulse-scout

---
