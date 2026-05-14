Hermes Agent Masterclass

这篇文章本质上是在回答一个问题：Hermes Agent 为什么会被很多人视为“更像一个会持续进化的 agent 系统”，而不只是一个能对话、能调工具的壳。它给出的答案是，Hermes 把 identity、memory、skills、background curation 和离线优化这几层拼成了一个完整学习闭环。用户先用 `SOUL.md` 固定人格与边界，再让 agent 在运行中把经验沉淀进 `MEMORY.md` / `USER.md`、会话搜索库和外部 memory provider；接着通过 skill system 把“做事方法”编码成可复用技能；再由 Curator 在后台整理、归档、合并这些技能；最后还可以用 GEPA 这类离线演化框架，基于真实 trace 去优化 skill，而不是单靠 agent 自评。换句话说，这篇文章不是在介绍单个功能，而是在介绍一个“agent 如何越来越像熟练员工”的系统设计。

EN: The article presents Hermes Agent as a learning-oriented agent framework rather than just a chat interface with tool use.
ZH: 这篇文章把 Hermes Agent 描绘成一个以“学习与演化”为中心的 agent 框架，而不只是一个会聊天、会调工具的界面。

EN: Its core claim is that Hermes combines identity, memory, skills, maintenance, and offline optimization into one coherent loop.
ZH: 它的核心论点是：Hermes 把 identity、memory、skills、维护机制和离线优化整合成了一个连贯闭环。

EN: Hermes is described as an agent that gets better the longer you use it.
ZH: 作者把 Hermes 描述成一种“越用越强”的 agent。

EN: What makes that possible is not one feature but the interaction between several layers.
ZH: 支撑这个特性的，不是某一个单点功能，而是多层机制之间的配合。

EN: The first layer is identity, defined through `SOUL.md`.
ZH: 第一层是 identity，由 `SOUL.md` 定义。

EN: `SOUL.md` sits at the top of the system prompt and defines personality, tone, style, and hard boundaries.
ZH: `SOUL.md` 位于系统提示词最前面，用来定义人格、语气、风格和硬边界。

EN: The article argues that without an identity layer, all agents feel like the same generic assistant in different clothes.
ZH: 文章认为，没有 identity 层的话，不同 agent 最终都会像同一个通用助手换了件衣服。

EN: `SOUL.md` is static and hand-authored, while the rest of the system evolves around it.
ZH: `SOUL.md` 是静态且由人手工维护的，而系统的其他部分则围绕它动态演化。

EN: In this framing, identity is the fixed frame, while memory and skills are the moving parts inside it.
ZH: 在这个框架里，identity 是固定框架，memory 和 skills 则是其中不断变化的部分。

EN: Hermes uses a three-tier memory architecture.
ZH: Hermes 采用三层 memory 架构。

EN: Tier 1 is two tiny markdown files: `MEMORY.md` and `USER.md`.
ZH: 第一层是两个很小的 markdown 文件：`MEMORY.md` 和 `USER.md`。

EN: `MEMORY.md` stores environment notes, project conventions, tool quirks, and lessons learned.
ZH: `MEMORY.md` 记录环境说明、项目约定、工具怪癖和经验教训。

EN: `USER.md` stores the user's profile, communication preferences, skill level, and avoidances.
ZH: `USER.md` 记录用户画像、沟通偏好、能力水平和需要避开的内容。

EN: These files are injected into the system prompt as a frozen snapshot at session start.
ZH: 这两个文件会在会话开始时以冻结快照的形式注入系统提示词。

EN: Writes persist immediately to disk, but newly written entries do not enter the current session prompt until the next session.
ZH: 新写入的内容会立刻落盘，但要到下一次会话才会重新进入 prompt。

EN: Because Tier 1 memory is tiny, the agent must consolidate when it starts to fill up.
ZH: 由于第一层记忆很小，快满时 agent 必须对内容做压缩整合。

EN: Tier 2 is full-text search over past conversations stored in SQLite.
ZH: 第二层是对历史会话做全文搜索，底层由 SQLite 存储。

EN: This gives Hermes effectively unbounded recall capacity, but only through active search and summarization.
ZH: 这让 Hermes 拥有近似无上限的回忆能力，但必须通过主动搜索和总结来调用。

EN: The tradeoff is clear: Tier 1 is tiny but always in context, while Tier 2 is large but only available on demand.
ZH: 取舍很明确：第一层很小但始终在上下文中，第二层很大但只能按需调取。

EN: Tier 3 is external memory providers.
ZH: 第三层是外部 memory provider。

EN: Hermes supports multiple pluggable providers that augment built-in memory rather than replacing it.
ZH: Hermes 支持多个可插拔 provider，它们是增强内建 memory，而不是直接替代。

EN: When an external provider is active, Hermes prefetches relevant memories before each turn and syncs turns after each response.
ZH: 当外部 provider 启用时，Hermes 会在每轮对话前预取相关记忆，并在响应后同步会话内容。

EN: This gives Hermes a broader persistence story than local files alone.
ZH: 这使 Hermes 的持久记忆能力超越了单纯本地文件的范围。

EN: The article distinguishes memory from skills.
ZH: 文章明确区分了 memory 和 skills。

EN: Memory stores facts, while skills store procedures.
ZH: memory 存的是事实，skills 存的是做事方法。

EN: Skills are markdown files with YAML frontmatter and serve as procedural memory.
ZH: skills 是带 YAML frontmatter 的 markdown 文件，本质上承担 procedural memory 的角色。

EN: Hermes uses progressive disclosure for skills to keep token costs low.
ZH: Hermes 对 skills 采用渐进式暴露，以降低 token 成本。

EN: At Level 0, the agent only sees names and descriptions of skills.
ZH: 在 Level 0，agent 只看到技能名称和描述。

EN: At Level 1, it loads the full skill when needed.
ZH: 到了 Level 1，它才会在需要时加载完整 skill。

EN: At Level 2, it can drill down into specific reference files inside a skill.
ZH: 到了 Level 2，它还可以继续钻取 skill 内部的参考文件。

EN: The article treats this skill mechanism as one of Hermes's biggest differentiators.
ZH: 文章把这套 skill 机制视为 Hermes 最核心的差异化之一。

EN: Hermes can autonomously create its own skills through the `skill_manage` tool.
ZH: Hermes 可以通过 `skill_manage` 工具自主创建自己的技能。

EN: Skill creation is triggered when the agent solves a complex task, overcomes repeated errors, is corrected by the user, or discovers a non-trivial workflow.
ZH: 当 agent 完成复杂任务、跨过反复报错、被用户纠正，或发现一个非平凡 workflow 时，就可能触发 skill 创建。

EN: The idea is that the agent should not rediscover the same successful process again and again.
ZH: 这里的核心思想是：agent 不该一遍遍重新摸索已经验证过的正确流程。

EN: Instead, it should encode the working approach as a reusable `SKILL.md` and load it next time.
ZH: 相反，它应该把成功方法编码成可复用的 `SKILL.md`，下次直接读取。

EN: The article emphasizes that the learning loop is not just memory accumulation but procedural accumulation.
ZH: 文章强调，这种学习闭环不只是积累事实记忆，更是在积累可操作流程。

EN: Without maintenance, however, autonomous skill creation leads to clutter.
ZH: 不过，如果没有维护，自动创建 skill 很容易导致技能库膨胀和混乱。

EN: That is why Hermes includes the Curator system.
ZH: 这就是 Hermes 引入 Curator 系统的原因。

EN: Curator is a background maintenance mechanism for agent-authored skills.
ZH: Curator 是一个专门维护 agent 自写技能的后台机制。

EN: It runs after a period of inactivity rather than on a strict cron loop.
ZH: 它不是严格按 cron 运行，而是在系统空闲一段时间后触发。

EN: Curator uses deterministic transitions for staleness and archival.
ZH: Curator 会先用确定性规则处理技能变旧和归档。

EN: Skills unused for 30 days become stale, and those unused for 90 days can be archived.
ZH: 30 天未使用的技能会变 stale，90 天未使用的则可能进入归档。

EN: It also performs an LLM-based review pass to decide whether to keep, patch, consolidate, or archive agent-created skills.
ZH: 此外它还会做一次 LLM 驱动的审查，决定某个 skill 是保留、修补、合并还是归档。

EN: Importantly, Curator never auto-deletes bundled or hub-installed skills.
ZH: 一个关键约束是，Curator 不会自动删除内置或 hub 安装的技能。

EN: The worst-case outcome is archival, which remains recoverable.
ZH: 它最激进的动作也只是归档，而且仍然可恢复。

EN: Hermes also snapshots the skills directory before a Curator pass, so rollbacks are easy.
ZH: 在 Curator 开跑前，Hermes 还会先给 skills 目录做快照，因此回滚相对容易。

EN: The article then points out a weakness in in-agent learning.
ZH: 接着文章指出了 agent 内部自学习的一大弱点。

EN: Agents tend to overestimate their own performance and produce self-congratulatory evaluations.
ZH: agent 往往会高估自己的表现，容易产生自我表扬式评估。

EN: They may also overwrite careful manual customizations with worse autogenerated versions.
ZH: 它们还可能用更差的自动生成版本，覆盖掉原本精心手工维护的 skill。

EN: This is where GEPA enters.
ZH: 这正是 GEPA 出场的地方。

EN: GEPA stands for Genetic-Pareto Prompt Evolution and lives outside the runtime as an offline optimization pipeline.
ZH: GEPA 指的是 Genetic-Pareto Prompt Evolution，它不是运行时的一部分，而是一个离线优化管线。

EN: Instead of asking the agent whether it performed well, GEPA reads execution traces to see why things failed.
ZH: GEPA 不是问 agent “你做得好吗”，而是直接读 execution trace，分析失败原因。

EN: It then proposes targeted skill improvements through evolutionary search.
ZH: 接着它通过进化式搜索提出针对性的 skill 改进方案。

EN: Candidate variants are evaluated with rubric-based LLM-as-judge scoring rather than simple binary pass/fail.
ZH: 候选方案通过带 rubric 的 LLM-as-judge 评分来评估，而不是简单二元通过/失败。

EN: Hard constraints are also enforced, such as passing the full test suite, staying within skill size limits, and preserving semantic intent.
ZH: 同时还会施加硬性约束，比如必须通过完整测试、控制 skill 体积，并保证语义目标不漂移。

EN: The best candidate becomes a PR, not a direct commit.
ZH: 最优候选最终会以 PR 形式输出，而不是直接提交进主分支。

EN: The article presents GEPA as an alternative to jumping straight into fine-tuning or RL-based optimization.
ZH: 文章把 GEPA 描述成一种在上 fine-tuning 或 RL 之前就值得优先尝试的替代路线。

EN: Another major theme is runtime portability.
ZH: 另一个重要主题是运行时可迁移性。

EN: Hermes can execute commands across six environments including local, Docker, SSH, Modal, Daytona, and Singularity.
ZH: Hermes 可以在六种环境中执行命令，包括本地、Docker、SSH、Modal、Daytona 和 Singularity。

EN: It also supports many model providers through a translation layer.
ZH: 它还通过一个翻译层兼容多种模型供应商。

EN: This means users can swap providers or execution backends without changing the surrounding architecture.
ZH: 这意味着用户可以在不改整体架构的前提下，替换模型供应商或执行后端。

EN: Hermes additionally imposes a hard cap on task turns to prevent runaway loops.
ZH: Hermes 还对任务回合数设置了硬上限，以防止失控循环烧掉额度。

EN: The article also spends time on multi-agent specialization.
ZH: 文章还花了不少篇幅讲多 agent 专业化。

EN: Hermes profiles let users create isolated agents such as a designer, programmer, and researcher.
ZH: Hermes 的 profile 系统允许用户创建彼此隔离的 agent，比如 designer、programmer 和 researcher。

EN: Each profile has its own config, memory, skills, sessions, and `SOUL.md`.
ZH: 每个 profile 都有自己独立的 config、memory、skills、sessions 和 `SOUL.md`。

EN: The separation is strict by default, which makes roles genuinely distinct.
ZH: 默认情况下这种隔离是严格的，因此不同角色会真正变得不同。

EN: The programmer profile can delegate execution to Claude Code while Hermes orchestrates.
ZH: programmer 这个 profile 甚至可以把执行层委派给 Claude Code，而由 Hermes 做上层编排。

EN: The designer profile can study reference images and create a style-reproducing skill.
ZH: designer 这个 profile 可以研究参考图，然后自己写出一个复现风格的 skill。

EN: The researcher profile can run scheduled digest jobs through Hermes cron.
ZH: researcher 这个 profile 则可以通过 Hermes cron 去跑定时摘要任务。

EN: This shows that Hermes is not only about a single self-improving agent, but also about a system for composing multiple specialized agents.
ZH: 这说明 Hermes 不只是关于单个会进化的 agent，而是关于一整套可组合的专业 agent 系统。

EN: The deepest takeaway is that Hermes tries to turn agent usage into a compounding process.
ZH: 这篇文章最深的一层启发，是 Hermes 试图把 agent 的使用过程变成一个复利过程。

EN: Identity makes behavior consistent, memory preserves facts, skills preserve methods, Curator manages accumulation, and GEPA improves the hard parts through evidence.
ZH: identity 让行为稳定，memory 保留事实，skills 保留方法，Curator 管理累积，GEPA 则用证据驱动的方式优化最难的部分。

EN: In that sense, Hermes is presented less as an assistant product and more as an architecture for institutionalizing agent learning.
ZH: 从这个意义上说，文章把 Hermes 描绘得更像一种“让 agent 学习制度化”的架构，而不是一个单纯的助手产品。