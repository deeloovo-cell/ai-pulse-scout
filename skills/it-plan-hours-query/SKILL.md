---
name: it-plan-hours-query
description: Use when the user asks to analyze an IT人员计划工时 Excel file, find people whose daily planned workload falls below a threshold across future weeks or a custom date range, list exact low-workload days per person, exclude 离职 staff, preview top rows, or export a full Excel result.
---

# IT人员计划工时查询

## Overview

Use this skill for Excel-based IT task/workload analysis where the result must stay grounded at the **person-day** level unless the user explicitly asks for summary output.

Default behavior:
- Prefer **person-level detail** over role-level summary
- Split planned workload evenly across **workdays** between task start and end dates
- Default threshold: `0.5`
- Default date range: **future two workweeks** if the user does not specify a range
- Auto-detect common headers for 姓名 / 岗位 / 开始日期 / 结束日期 / 计划工时 when column letters are not provided
- If the user expresses a threshold in hours, convert it with the rule **1天 = 8小时** unless the user overrides it
- Support business-role synonyms when the user implies merged concepts, for example **需求分析师 ≈ 业务分析师**
- When the user names an organization informally (for example “顾问组”), inspect actual organization values first and confirm the closest match when needed
- If the user asks to exclude resigned staff, filter names containing `离职`

## When to Use

Use when the user asks for any of these:
- IT人员计划工时查询
- 未来两周计划工时排查
- 单日计划工时低于某阈值
- 明确列出哪些人在哪几天工时不足
- 导出完整 Excel 结果
- 排除离职人员后重算

Do not use this skill when:
- The user only wants a generic spreadsheet summary with no workload/date logic
- The source is not an Excel-style task/workload table
- The user wants a knowledge-base article or prose-only summary

## Default Calculation Rule

Unless the user overrides it:
1. Read one workbook sheet
2. Use the effective columns for:
   - name
   - role (optional but preferred)
   - start date
   - end date
   - planned workload
3. Build the target workday range
4. Distribute each task's planned workload evenly across workdays from start to end date
5. Aggregate by `(person, day)`
6. Keep days where `daily_planned_workload < threshold`
7. Output person-level detail with explicit dates

## Workflow

1. Locate the Excel file the user provided
2. Inspect workbook/sheet/header structure if the mapping is unclear
3. Determine effective columns
   - prefer user-provided column letters
   - otherwise auto-detect common Chinese/English-style headers
4. Determine date range, threshold, resignation filter, sort rule, and output mode
5. Normalize business language before calculating:
   - convert hour-based thresholds into day-based thresholds when needed
   - expand role synonyms when the user treats multiple titles as one concept
   - resolve informal organization names against actual organization values in the sheet
6. Run the script:
   - `skills/it-plan-hours-query/scripts/query_plan_hours.py`
7. Return top preview rows or send the generated Excel file

## Clarification Order

Only ask follow-up questions when the file or mapping is unclear. Ask in this order:
1. Which sheet to use
2. Which columns map to name / role / start / end / planned workload
3. Date range
4. Threshold
5. Whether the threshold is expressed in days or hours
6. Whether role synonyms should be merged (for example 需求分析师 + 业务分析师)
7. Whether the named organization matches an actual organization value in the sheet
8. Whether to exclude resigned staff
9. Preview vs full export

If the file and columns are already clear, calculate directly.

## Output Priority

Default output priority:
1. **Person-level detail** with exact low-workload dates
2. **Top-N preview** for validation
3. **Full Excel export**
4. **Role summary** only if the user explicitly requests it

## Required Output Shape

For person-level detail, prefer these fields:
- 排名
- 姓名
- 岗位
- 低于阈值的工作日数
- 这些日期工时合计
- 具体日期

For exported Excel, include at least:
- 姓名
- 岗位
- 低于阈值的工作日数
- 这些日期工时合计
- 具体日期
- Each workday column in the target range for audit/review

## Script Usage

### Preview top 10

```bash
python3 skills/it-plan-hours-query/scripts/query_plan_hours.py \
  --file "/path/to/file.xlsx" \
  --name-col B --role-col C --start-col K --end-col L --plan-col N \
  --start-date 2026-05-11 --end-date 2026-05-22 \
  --threshold 0.5 --exclude-resigned --top 10
```

### Hour-based threshold

```bash
python3 skills/it-plan-hours-query/scripts/query_plan_hours.py \
  --file "/path/to/file.xlsx" \
  --start-date 2026-05-15 --end-date 2026-05-15 \
  --threshold-hours 4 --org-value "软件开发顾问部"
```

### Role synonym preset

```bash
python3 skills/it-plan-hours-query/scripts/query_plan_hours.py \
  --file "/path/to/file.xlsx" \
  --start-date 2026-05-13 --end-date 2026-05-14 \
  --threshold 1 --role-alias analyst
```

### Role keyword filter

```bash
python3 skills/it-plan-hours-query/scripts/query_plan_hours.py \
  --file "/path/to/file.xlsx" \
  --start-date 2026-05-15 --end-date 2026-05-15 \
  --threshold-hours 4 --org-value "软件开发顾问部" \
  --role-contains "开发工程师"
```

### Export full Excel

```bash
python3 skills/it-plan-hours-query/scripts/query_plan_hours.py \
  --file "/path/to/file.xlsx" \
  --name-col B --role-col C --start-col K --end-col L --plan-col N \
  --start-date 2026-05-11 --end-date 2026-05-22 \
  --threshold 0.5 --exclude-resigned \
  --export "/path/to/output.xlsx"
```

## Guardrails

- Do **not** silently change from person-level detail to role-level aggregation
- Keep preview results and exported Excel under the **same calculation rule**
- If headers differ from expectation, inspect first and explain the detected mapping
- If the user says “原要求不变”, preserve the previous calculation rule and only apply the requested delta
- Do **not** assume “未排满” means the same threshold every time; infer from the user's wording and normalize explicitly
- Do **not** assume business titles are distinct if the user says they are the same concept
- When the user describes a broad岗位集合 such as “开发人员”, prefer keyword filtering like `开发工程师` unless the user gives a stricter definition
- Do **not** assume informal organization names exactly match sheet values; inspect and confirm the closest real value when needed

## Error Handling

Report specific issues instead of giving a vague failure:
- file not found
- sheet not found
- required column missing
- header auto-detection failed for a required field
- date parse failure
- planned workload parse failure
- export generation failure

When reporting an issue:
1. Say what was detected
2. Say what cannot be computed yet
3. Ask the smallest useful follow-up question or offer the closest fallback

## References

See `references/examples.md` for example prompts and result patterns.
