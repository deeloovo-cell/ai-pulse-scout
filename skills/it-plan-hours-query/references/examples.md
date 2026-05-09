# IT人员计划工时查询 Examples

## Example 1: Preview top 10 low daily workload staff

用户：
> 基于这份 Excel，按照 K/L 起止日期和 N 列计划工时，帮我找出未来两周单日计划工时低于 0.5 的人员，并明确是哪几天，先输出前十条。

期望：
- 按个人输出
- 明确列出具体日期
- 先给前十条验证

## Example 2: Export full Excel excluding resigned staff

用户：
> 按刚才格式导出完整 Excel，并排除已离职人员。

期望：
- 保持原口径不变
- 排除姓名中含“离职”的人员
- 导出完整 Excel 文件

## Example 3: Auto-detect headers without column letters

用户：
> 这个表头里有“姓名 / 岗位 / JIRA任务开始日期 / JIRA任务结束日期 / 任务计划天数”，帮我查未来两周单日低于 0.5 的人员，先给前十条。

期望：
- 不手动传列字母
- 自动识别表头
- 输出仍然是按个人 + 明确日期

## Example 4: Override columns and date range

用户：
> 姓名列是 D，岗位列是 E，开始列是 M，结束列是 N，计划工时列是 Q，查询 2026-06-01 到 2026-06-14，阈值 1.0。

期望：
- 使用覆盖列位
- 使用指定日期范围
- 使用新阈值重新计算

## Response Pattern

推荐响应顺序：
1. 简要说明计算口径（若口径会影响理解）
2. 返回前十条或摘要结果
3. 用户确认后再导出完整 Excel
4. 若用户明确要求汇总，再切换到汇总视图

## Important Reminder

如果用户要的是“明确到个人、明确到日期”，不要擅自改成岗位汇总或部门汇总。
