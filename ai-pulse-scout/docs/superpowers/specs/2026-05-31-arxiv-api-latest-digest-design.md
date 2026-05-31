# AI Pulse Scout arXiv API 最新日报设计

## 背景

当前 AI Pulse Scout 已收敛到 arXiv-only 配置：

- `config/source-inbox.md` 仅保留 `https://arxiv.org/`
- `config/sources.yaml` 仅保留由该入口展开出的 18 个 arXiv category source

现有抓取链路依赖这些 category 对应的 RSS feed，但运行验证表明当前 RSS 经常只返回 channel 元信息而不返回可消费的 item，导致：

- `site:export --date 2026-05-30` 返回 `Items: 0`
- `site:export --date 2026-05-31` 返回 `Items: 0`

用户当前目标不是回放历史某一天，而是从现在开始，基于 arXiv 最新可见内容，稳定生成一份有真实内容的日报静态站页面。

## 目标

在不改变 arXiv-only 配置语义的前提下，把 arXiv 内容抓取从 RSS 切换到更稳定的 arXiv API 路径，使系统能够：

1. 对 18 个 arXiv category source 抓取最新论文元数据
2. 按当前 digest 日期窗口筛选“当天可见内容”
3. 继续复用现有 dedupe / select / enrich / static export 链路
4. 为 `2026-05-31` 导出一份包含真实 arXiv 条目的静态页面

## 非目标

本次不做以下内容：

- 历史日期回填或历史可靠重放
- source universe 扩展回更大的历史集合
- `source-inbox.md` / `sources.yaml` 结构修改
- daily archive 持久化方案的完整落地
- 发布到 `daily.deanlu.ai`
- review app / rating / follow-up 等交互式功能

## 约束

- `config/source-inbox.md` 与 `config/sources.yaml` 必须保持一致
- 仅允许 arXiv-only scope
- `config/sources.yaml` 继续保留现有 18 个 source，不新增其他站点
- 优先复用现有 pipeline，而不是重写整条日报链路

## 设计概览

### 1. 配置层保持不变

配置语义不变：

- inbox 仍表示“只跟踪 arXiv”
- sources 仍表示“18 个 arXiv 分类入口”

因此，修改点不在配置，而在“这些 source 如何被抓取”。

### 2. 抓取层改为 arXiv API

当前 source 仍然保留 category 信息（如 `cs.AI`、`cs.LG`、`stat.ML` 等），但 adapter 不再依赖 RSS 响应中的 `<item>` 列表，而是根据 source URL 推导对应 category，然后通过 arXiv API 获取最近论文条目。

建议抓取策略：

- 从 source URL 提取 category（例如 `https://arxiv.org/rss/cs.AI` -> `cs.AI`）
- 通过 arXiv API 以该 category 作为查询条件拉取最近论文
- 对返回结果做标准化映射，输出为现有 `NormalizedItem` 兼容结构
- 只保留落在目标 digest 窗口内的条目

### 3. 其余链路保持原样

抓取到的 item 进入现有流程：

- `dedupeItems`
- `selectItems`
- `enrichSelectedItems`
- `renderStaticSite`
- `exportStaticSite`

这样可以把变更风险收敛在 ingest / adapter 层。

### 4. 日期语义

当前阶段保留现有 `site:export --date` 语义与窗口计算方式，不同时引入“自然日”和“抓取改造”两个变量。

也就是说：

- 当前先解决“为什么 18 个 arXiv source 会抓不到真实 item”
- 不在本次同时改动 digest 日期窗口定义

如果后续需要把静态站日期语义调整为自然日，再单独设计。

## 组件设计

### A. arXiv API 抓取辅助模块

新增一个轻量抓取模块，职责：

- 接收 arXiv category 与窗口参数
- 调用 arXiv API
- 解析返回的 Atom/XML 数据
- 转换成统一中间结构

建议输出字段至少包括：

- arXiv id
- title
- summary / abstract
- authors
- published date
- updated date
- primary category
- canonical URL
- pdf URL（如果可得）

### B. 现有 Papers/Feed 抓取路径接入点

实现上允许两种接入方式，推荐第一种：

1. **推荐：**在现有 arXiv source 命中时走专用 arXiv API 逻辑
2. 可选：新增独立 `ArxivApiAdapter`，再由 ingest 分发

推荐理由：

- 变更范围更清晰
- 不会影响其他未来非 arXiv source
- 容易通过 source URL 特征判断是否进入 arXiv API 分支

### C. 标准化映射

API 返回的论文条目需要映射到现有 digest item 结构，至少满足：

- `source_name`：沿用当前 source name（如 `arXiv CS.AI`）
- `source_url`：沿用 source URL
- `item_url`：论文 canonical URL
- `title`
- `content_text`：优先使用摘要
- `published_at`
- `fingerprint` / dedupe identity：基于 arXiv id 或 canonical URL 稳定生成
- topic/category 元数据：保留 arXiv category 信息

## 数据流

1. `site:export --date YYYY-MM-DD`
2. 计算 digest 窗口
3. 读取 18 个 arXiv source
4. 对每个 source 调 arXiv API 抓取最近条目
5. 过滤到窗口内 item
6. 标准化输出
7. 走现有 dedupe / select / enrich
8. 输出静态页

## 错误处理

- 单个 category API 失败时，不应导致全量导出直接崩溃
- 对失败 category 记录日志并继续其他 source
- API 返回空结果时，记为该 category 本次无内容，而不是结构错误
- XML/Atom 解析失败时，应包含 source/category 信息，便于定位

## 测试策略

### 单元测试

新增测试覆盖：

1. 从 arXiv RSS source URL 提取 category
2. arXiv API 响应解析为统一条目结构
3. 日期窗口过滤正确生效
4. dedupe key / canonical URL 映射稳定

### 集成测试

新增/更新测试覆盖：

1. 对 arXiv source 的 ingest 不再依赖 RSS `<item>`
2. `site:export` 在注入的 arXiv API 假数据下可生成非空页面
3. 页面中出现真实论文标题与链接，而不是空状态

## 验收标准

本次工作完成后，应满足：

1. `config/source-inbox.md` 仍只有 `https://arxiv.org/`
2. `config/sources.yaml` 仍只有对应 18 个 arXiv source
3. arXiv-only 配置下，抓取逻辑不再依赖当前 RSS 是否返回 `<item>`
4. `npm test` 通过
5. 重新运行 `npm run site:export -- --date 2026-05-31` 时，不再得到 `Items: 0`
6. `data/output/site/index.html` 与 `data/output/site/days/2026-05-31.html` 中出现真实 arXiv 条目

## 风险与后续

### 风险

- arXiv API 的排序/更新时间语义可能与现有 digest cutoff 不完全一致
- 某些 category 在单日窗口中本身仍可能无内容
- 如果 18 个 category 存在交叉收录，同一论文可能跨 category 返回，需要依赖现有 dedupe 稳定收敛

### 后续（不在本次）

- 增加 daily archive 持久化，避免未来站点重建依赖重新抓取
- 明确静态站日期语义是否从 digest cutoff 改为自然日
- 为首页最近 7 天列表接入真实 archive 枚举
