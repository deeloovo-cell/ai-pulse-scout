# IT人员计划工时查询 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable local skill that analyzes Excel-based IT task plans, identifies people whose daily planned workload falls below a threshold across a date range, and exports preview/full Excel outputs.

**Architecture:** Implement a skill folder with a focused `SKILL.md`, one standalone Python script for xlsx parsing and export, and one examples reference file. The script handles calculation/export; the skill document handles trigger conditions, defaults, overrides, and response/output rules.

**Tech Stack:** OpenClaw AgentSkills markdown, Python 3 standard library, raw XLSX zip/xml parsing, git

---

## File Structure

- Create: `skills/it-plan-hours-query/SKILL.md`
- Create: `skills/it-plan-hours-query/scripts/query_plan_hours.py`
- Create: `skills/it-plan-hours-query/references/examples.md`

## Tasks

### Task 1: Create skill documentation
- [ ] Write `skills/it-plan-hours-query/SKILL.md` with trigger conditions, defaults, workflow, clarification order, output rules, and error handling.
- [ ] Commit.

### Task 2: Implement the Python analysis/export script
- [ ] Write `skills/it-plan-hours-query/scripts/query_plan_hours.py` using Python stdlib only.
- [ ] Support xlsx reading, sheet selection, column mapping, date/hour parsing, workday distribution, person-day aggregation, resigned filtering, preview output, and xlsx export.
- [ ] Commit.

### Task 3: Add usage examples
- [ ] Write `skills/it-plan-hours-query/references/examples.md`.
- [ ] Commit.

### Task 4: Verify end-to-end behavior
- [ ] Run preview command against the sample workbook.
- [ ] Run export command.
- [ ] Confirm generated files exist.
- [ ] Commit final state.
