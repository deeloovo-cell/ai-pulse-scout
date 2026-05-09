# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260426-001] correction

**Logged**: 2026-04-26T16:17:00+08:00
**Priority**: high
**Status**: promoted
**Area**: docs

### Summary
`KB + <link>` should be treated as a save-to-Notion knowledge base workflow, not just an in-chat KB-style summary.

### Details
The user corrected that the broader rule is about knowledge-base ingestion: when they send `KB + link`, the expected action is to read the source, produce a KB-style Chinese entry, and save it into the Notion knowledge base. `arx + <arXiv link>` is not a separate destination, but the arXiv-specific variant of the same workflow, with the format preference of a long summary rather than full text. I previously handled two such requests only as chat summaries and failed to persist them.

### Suggested Action
Persist this convention in workspace memory and apply it by default going forward. Treat `arx` as an arXiv-specific KB ingestion trigger, not a different storage rule. When missed, apologize briefly and backfill the Notion entries.

### Metadata
- Source: user_feedback
- Related Files: USER.md
- Tags: notion, kb, preference, workflow

---

## [LRN-20260501-001] best_practice

**Logged**: 2026-05-01T20:19:00+08:00
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Notion KB bilingual color formatting becomes inconsistent when fallback ingestion uses a plain temporary page-creation script that only writes unstyled paragraph blocks.

### Details
The user asked why English/Chinese text colors are sometimes missing in Notion KB pages. Root cause: when the normal KB ingestion path is unavailable, I have been using `tmp_create_kb_record.mjs` as a fallback. That script creates only plain paragraph blocks and does not apply any language-specific rich_text annotations or post-processing color operations, so pages created through that fallback lose the required bilingual color differentiation. This makes the workflow appear flaky: entries written through a richer path can preserve styling, while fallback-written entries cannot.

### Suggested Action
Do not present fallback KB saves as equivalent to the standard KB pipeline. Either (1) add explicit color-aware block generation / post-write recoloring to the fallback path, or (2) clearly label fallback saves as unformatted temporary captures and offer a later normalization pass. Prefer fixing the pipeline so every KB write enforces the user's bilingual color rule by default.

### Metadata
- Source: user_feedback
- Related Files: tmp_create_kb_record.mjs, USER.md
- Tags: notion, kb, formatting, color, fallback
- Pattern-Key: notion.kb.bilingual-color-loss
- Recurrence-Count: 1
- First-Seen: 2026-05-01
- Last-Seen: 2026-05-01

---

## [LRN-20260509-001] correction

**Logged**: 2026-05-09T07:25:13+00:00
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
When the user asks for low-workload results by person, do not switch to role-level aggregation unless explicitly requested

### Details
The user wanted a person-level list of future workdays where daily planned workload is below 0.5. A role summary was produced instead, which changed the output grain and format.

### Suggested Action
Keep the original grain (person-day detail) unless the user explicitly asks for grouping or summary aggregation.

### Metadata
- Source: user_feedback
- Related Files: .learnings/LEARNINGS.md
- Tags: output-format, aggregation, excel

---

## [LRN-20260509-002] correction

**Logged**: 2026-05-09T08:07:02+00:00
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
For this user's workload queries, 需求分析师 and 业务分析师 should be treated as the same concept unless the user asks to separate them

### Details
The user corrected the role interpretation after a query limited to 需求分析师. Future workload filtering for this user should combine both labels when they ask for 需求分析师 unless they explicitly want the roles separated.

### Suggested Action
When filtering by analyst roles for this user, include both 需求分析师 and 业务分析师 by default, and mention the combined rule in the output.

### Metadata
- Source: user_feedback
- Related Files: skills/it-plan-hours-query/SKILL.md
- Tags: role-mapping, workload, analyst

---
