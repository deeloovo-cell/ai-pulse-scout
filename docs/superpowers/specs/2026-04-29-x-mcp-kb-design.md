# X MCP KB Integration Design

Date: 2026-04-29
Status: Draft

## Goal

解决 `KB: <x链接>` 在知识库入库流程中无法稳定读取 X / Twitter 正文的问题。

第一阶段目标是：
- 通过 X MCP 读取单条帖文或线程内容
- 将可用正文交给现有 Notion KB 流程处理
- 在无法获取完整内容时明确标注“部分内容”而不是伪装成全文
- 为未来扩展成通用 X MCP 能力预留结构，但当前不实现搜索、时间线或批量归档

## Scope

### In scope

- 新增一个独立 skill：`x-mcp-reader`
- 让它面向 `KB:` 场景读取 X 链接内容
- 为该 skill 提供接入说明、验证方式和常见故障诊断
- 更新现有 `notion-ludi` skill，让 `KB:` 遇到 X 链接时优先走 X MCP 路径
- 定义失败回退策略和“部分内容”标注规则

### Out of scope

- 通用 X 搜索能力
- 用户主页 / 时间线抓取
- 点赞、转发、评论等互动数据分析
- 非 KB 场景的完整产品化封装
- 自动安装任何尚不明确的第三方 MCP server

## Problem Statement

当前 `KB:` 对普通网页可通过 readable fetch、xcrawl、browser fallback 等路径抓取，但 X 链接经常会遇到：
- 登录墙
- 反爬壳页面
- 线程展开不完整
- 只抓到摘要或页面骨架

结果是知识库里要么拿不到正文，要么只能保存不完整内容，而且容易误判为“全文已抓取”。

## Proposed Solution

采用“双层结构”：

1. `x-mcp-reader` 负责从 X MCP 中获取适合知识库使用的内容
2. `notion-ludi` 负责把这些内容按现有 DL-KB 规范写入 Notion

这样可以把“内容获取”和“知识库写入”分离，避免把 X 平台细节塞进 Notion skill 主体。

## Architecture

### Component 1: `x-mcp-reader` skill

职责：
- 识别 X / Twitter 链接
- 说明何时应优先使用 X MCP
- 指导如何从 MCP 结果中提取：
  - 作者
  - 帖文正文
  - 时间
  - 线程中的连续正文
  - 可能存在的外链
- 区分以下结果状态：
  - `full`：拿到足够完整的单帖或线程正文
  - `partial`：只拿到部分内容、摘要、截断线程或不完整展开
  - `unavailable`：MCP 不可用、权限不足或内容无法访问

输出目标不是直接写 Notion，而是生成一个适合 KB 流程消费的规范化内容包。该内容包至少应包含：
- `source_type`: `x-post` | `x-thread` | `x-share-link`
- `status`: `full` | `partial` | `unavailable`
- `url`
- `author`
- `published_at`（若 MCP 可提供）
- `body_segments`：按顺序排列的正文片段列表
- `discovered_links`：从帖文中提取出的外链列表
- `notes`：关于缺失内容、线程截断或访问限制的说明

### Component 2: `notion-ludi` integration update

当用户发出 `KB: <x链接>` 时，抓取顺序调整为：

1. 判断是否为“X 上分享的外部文章链接”
   - 如果主要价值在外部原文，优先定位外部原文页面
2. 如果目标本身就是 X 帖文 / 线程，优先使用 `x-mcp-reader`
3. 若 X MCP 不可用，再走现有 fallback（如 xcrawl、browser、source discovery）
4. 如果最终只获得部分内容，入库时必须明确标注“部分内容 / 基于可访问片段”

## Content Rules for KB Output

当来源是 X 帖文或线程时，KB 页面应继续遵守现有规范：
- 保留紧凑中文概述在最前
- 不在正文首行重复裸 URL
- 非中文内容继续采用英文原文 + 中文翻译的双语布局
- 英文与中文继续使用两种不同颜色区分
- 若只能获取部分帖文/线程，必须在正文前明确说明内容范围

对于 X 内容，不强求“全文”这个词，改为更准确的口径：
- 单帖：保存帖文正文
- 线程：保存可获取到的线程正文
- 部分抓取：显式标为部分内容

## MCP Dependency Model

该设计不假设当前环境已经自动安装并接通 X MCP。

第一版交付内容包括：
- skill 本身
- references 中的接入说明
- 如何在本机 / OpenClaw 环境中接入该 MCP 的说明
- 如何验证 MCP 是否能读取指定 X 链接

不在第一版里承诺：
- 自动发现并安装所有依赖
- 自动修复外部 MCP 服务本身的问题

## Error Handling

### Case 1: MCP server 未安装或未接入
行为：
- skill 文档提示当前缺少依赖
- 回退到现有抓取路径
- 不宣称已使用 X MCP 成功读取

### Case 2: MCP 可用，但返回结构化摘要而非完整正文
行为：
- 标记结果为 `partial`
- 在 KB 页面中明确说明基于 MCP 可访问内容整理

### Case 3: 线程未完整展开
行为：
- 标记为 `partial`
- 仅保存已确认拿到的连续内容
- 不脑补缺失楼层

### Case 4: X 帖文主要是在转发外部文章
行为：
- 优先寻找原始文章链接
- 如果原文可访问，则交回普通 KB 抓取流程

### Case 5: MCP 返回内容与网页 fallback 内容明显冲突
行为：
- 优先以 X MCP 结果作为主依据
- 如 fallback 补充了 MCP 未提供但明显属于正文的外链信息，可作为辅助信息纳入
- 不混合拼接彼此矛盾的正文内容

## Testing / Verification Plan

在实现阶段至少验证以下场景：

1. 单条公开 X 帖文可读取
2. 公开线程可读取至少多条连续内容
3. 仅能读到部分内容时被正确标记
4. MCP 不可用时正确回退
5. `notion-ludi` 在 X 链接场景下会优先选择 X MCP 路径
6. Notion 最终输出继续符合 DL-KB 双语配色规范

## Deliverables

### New skill
- `skills/x-mcp-reader/SKILL.md`
- `skills/x-mcp-reader/references/...`（接入说明、诊断说明等）

### Updated skill
- 更新 `notion-ludi` 的 KB 获取顺序说明，加入 X MCP 优先策略

### Optional helper artifacts
如果 MCP 的调用方式需要固定化，本设计允许增加少量 helper 脚本或命令模板，但前提是它们只服务于 X MCP 读取和验证，不扩展为通用社媒框架。

## Recommended Rollout

1. 先落地 `x-mcp-reader` skill 文档和调用约定
2. 再更新 `notion-ludi` 的 X 链接抓取顺序
3. 最后补验证说明与故障排查说明

## Success Criteria

满足以下条件即可视为第一阶段成功：
- 遇到 `KB: <x链接>` 时，流程优先尝试 X MCP
- 能够比现有网页抓取方式更稳定地获得单帖或线程正文
- 当内容不完整时，会明确标记为部分内容
- Notion KB 页面继续遵守既有双语与配色规范
- 整体结构为以后扩展通用 X MCP 功能保留空间
