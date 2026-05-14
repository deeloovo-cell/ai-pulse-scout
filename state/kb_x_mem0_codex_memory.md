How Memory works in Codex CLI

这篇内容表面上是在解释 Codex CLI 的 memory 机制，实际上更像是在拆解一个 coding agent 如何把“长期记忆”分成不同职责层：一层是人工维护、稳定不变的项目规则；另一层是 agent 自动从过往会话里提炼出的动态记忆。mem0 的文章认为，Codex 原生 memory 的设计思路很清楚：用 `AGENTS.md` 处理静态、长期有效的规则，用后台生成的 Memories 处理会话里逐渐沉淀出来的上下文。但它也指出，这套设计天然偏向“单用户、单机器、本地使用”，一旦进入跨机器、跨工具、团队共享或语义检索需求更强的场景，就会出现明显边界。因此文章后半部分实际上是在论证：为什么还需要一个像 Mem0 这样的外部 memory layer，去补足 Codex 本地 memory 在可迁移性、可共享性和召回方式上的不足。

EN: Codex's memory model is split into two layers: a static instruction layer and a generated memory layer.
ZH: Codex 的记忆模型被拆成两层：静态指令层和自动生成的记忆层。

EN: The static layer is `AGENTS.md`, which users or teams write manually and Codex reads at the start of every session.
ZH: 静态层就是 `AGENTS.md`，由用户或团队手工维护，Codex 在每次会话开始时读取。

EN: The generated layer is called Memories, where Codex summarizes previous sessions in the background and stores the results under `~/.codex/memories/`.
ZH: 自动生成层叫做 Memories，Codex 会在后台总结过去的会话，并把结果写到 `~/.codex/memories/` 下。

EN: These two layers solve different problems and have different limits.
ZH: 这两层解决的是不同问题，也各自带着不同的限制。

EN: `AGENTS.md` is meant for stable knowledge the agent should know from the first turn onward.
ZH: `AGENTS.md` 适合存放从第一轮起 agent 就应该知道、而且长期稳定的知识。

EN: Examples include project conventions, deploy commands, test runners, code style rules, and glossary-like definitions.
ZH: 例如项目约定、部署命令、测试方式、代码风格规则，以及一些术语词典式定义。

EN: Codex loads `AGENTS.md` through a layered discovery process, combining global and project-level files.
ZH: Codex 读取 `AGENTS.md` 时采用分层发现机制，会把全局文件和项目路径上的文件拼接起来。

EN: It can also be configured to use fallback filenames such as `CLAUDE.md` or `.cursorrules`.
ZH: 它还可以配置成读取其他兼容文件名，比如 `CLAUDE.md` 或 `.cursorrules`。

EN: However, `AGENTS.md` has a default size cap of 32 KiB, and truncation beyond that limit is silent.
ZH: 但 `AGENTS.md` 默认有 32 KiB 的大小上限，超过以后会静默截断。

EN: More importantly, `AGENTS.md` is not designed for facts that emerge during an ongoing conversation.
ZH: 更重要的是，`AGENTS.md` 并不适合保存会话过程中临时浮现出来的新事实。

EN: Users must remember to update it manually, and the agent does not autonomously maintain that file.
ZH: 用户得自己记得去更新它，agent 不会自主维护这个文件。

EN: That is the gap Memories is designed to close.
ZH: 这正是 Memories 这层设计出来要补的空白。

EN: Codex's Memories feature is configured under `[memories]` in `~/.codex/config.toml`.
ZH: Codex 的 Memories 功能通过 `~/.codex/config.toml` 里的 `[memories]` 配置项控制。

EN: Memories runs asynchronously rather than inline with an active chat turn.
ZH: Memories 采用异步运行，而不是在当前对话回合里同步执行。

EN: A session must stay idle for several hours before it becomes eligible for consolidation.
ZH: 一个会话必须空闲数小时后，才会进入可被整合的状态。

EN: Active sessions are never consolidated immediately.
ZH: 仍在活跃中的会话不会被立刻合并进记忆。

EN: The pipeline uses two models: one to decide what is worth remembering and another to merge it into the memory store.
ZH: 这条流水线会用两个模型：一个负责判断哪些内容值得记住，另一个负责把它们合并进现有记忆库。

EN: The consolidation process only considers a bounded number of recent rollouts.
ZH: 整合过程只会考虑一个有上限的最近会话集合。

EN: Rollouts that go unused for thirty days are aged out, and individual memories that are never recalled can also be pruned.
ZH: 三十天内没有再被用到的 rollout 会被老化淘汰，而长期不被召回的记忆条目也可能被修剪。

EN: Codex also avoids running consolidation when API quota is low.
ZH: Codex 还会在 API 配额偏低时避免执行记忆整合。

EN: The system performs secret redaction before writing memory data to disk.
ZH: 在把记忆写入磁盘前，系统会先做敏感信息脱敏。

EN: Reading and writing memories are controlled by separate switches, so users can choose asymmetric modes such as read-only or write-only.
ZH: 读取记忆和写入记忆由两个独立开关控制，因此用户可以采用只读或只写这类不对称模式。

EN: Internally, the memory pipeline has two phases: per-rollout extraction and global consolidation.
ZH: 在内部实现上，记忆流水线可以分成两个阶段：单次会话提取和全局整合。

EN: Phase 1 extracts candidate memories using a strict schema and redacts secrets.
ZH: 第一阶段会用严格 schema 从单次会话里提取候选记忆，并执行敏感信息脱敏。

EN: Phase 2 acquires a global lock, prepares a workspace, runs a consolidation sub-agent, and writes the merged diff.
ZH: 第二阶段会拿全局锁、准备工作区、运行 consolidation 子代理，然后写回合并后的差异。

EN: The storage format is not a vector database but a small set of markdown files.
ZH: 它的存储格式并不是向量数据库，而是一组体量不大的 markdown 文件。

EN: These include `memory_summary.md`, `MEMORY.md`, `raw_memories.md`, skill-specific memory files, and rollout summaries.
ZH: 这些文件包括 `memory_summary.md`、`MEMORY.md`、`raw_memories.md`、按技能拆分的记忆文件，以及 rollout summaries。

EN: Recall is also simpler than many people expect.
ZH: 它的召回方式也比很多人想象得更朴素。

EN: Codex reads `memory_summary.md` in full at session start and truncates it to fit the context budget.
ZH: Codex 会在会话开始时整体读入 `memory_summary.md`，然后按上下文预算做截断。

EN: If more detail is needed, the agent is instructed to `grep` over `MEMORY.md`.
ZH: 如果需要更多细节，agent 会被引导去对 `MEMORY.md` 执行 `grep` 检索。

EN: This means native recall is deterministic and simple, but not semantic.
ZH: 这意味着原生召回方式是简单、可预测的，但并不具备语义检索能力。

EN: The article argues that this design works well for one developer on one machine.
ZH: 文章认为，这套设计对于“单个开发者在单台机器上使用”这一场景是成立的。

EN: But its limits become obvious outside that shape.
ZH: 但一旦离开这个理想边界，它的局限就会立刻显现出来。

EN: There is no cross-machine sync for the CLI's generated memory state.
ZH: CLI 生成出来的记忆状态并没有跨机器同步能力。

EN: A second laptop, fresh container, or remote server starts with no memory unless Codex rebuilds it locally.
ZH: 第二台笔记本、全新容器或远程服务器一开始都没有这些记忆，除非 Codex 在本地重新积累出来。

EN: There is also no team-level shared memory for generated knowledge.
ZH: 对于自动生成出来的知识，它也没有团队级共享记忆。

EN: Teams can share static knowledge through checked-in `AGENTS.md`, but not their generated session memories.
ZH: 团队可以通过纳入版本控制的 `AGENTS.md` 共享静态知识，但没法共享各自生成的会话记忆。

EN: Another limitation is that the generated memory files are treated as managed state rather than a supported user-edit surface.
ZH: 另一个限制是，生成的记忆文件被视为受系统管理的状态，而不是鼓励用户手工编辑的界面。

EN: The article also highlights geographic limits: Memories is not available at launch in the EEA, UK, or Switzerland.
ZH: 文章还特别指出了地域限制：Memories 在上线时并不对 EEA、英国和瑞士开放。

EN: For those users, only the `AGENTS.md` layer exists.
ZH: 对这些地区的用户来说，真正可用的只有 `AGENTS.md` 这一层。

EN: The latter part of the article uses these gaps to explain where Mem0 fits.
ZH: 文章后半段就是借这些缺口来说明 Mem0 适合插在哪一层。

EN: Mem0 is presented as a memory layer that sits between the agent and a persistent store.
ZH: Mem0 被描述成一个位于 agent 与持久化存储之间的 memory layer。

EN: In Codex, it plugs in through MCP and exposes memory-related tools directly to the agent.
ZH: 在 Codex 里，它通过 MCP 接入，并直接向 agent 暴露一组 memory 相关工具。

EN: Mem0's core promise is persistent memory that survives across laptops, servers, and environments.
ZH: Mem0 的核心承诺之一，是让记忆跨笔记本、服务器和各种环境持续存在。

EN: That removes the local-machine ceiling of `~/.codex/memories/`.
ZH: 这等于移除了 `~/.codex/memories/` 只局限于本机的天花板。

EN: It also allows cross-tool memory, so Codex CLI and Cursor can recall from the same backend.
ZH: 它还允许跨工具共享记忆，比如 Codex CLI 和 Cursor 可以共用同一个后端。

EN: The article contrasts Mem0's semantic retrieval with Codex's native `memory_summary.md` plus `grep` approach.
ZH: 文章把 Mem0 的语义检索，与 Codex 原生“`memory_summary.md` + `grep`”的方式做了鲜明对比。

EN: With semantic retrieval, a user can ask for a deploy command and still recover the relevant memory even if the wording does not overlap.
ZH: 借助语义检索，即使用户的提问措辞和原始记忆不重叠，也仍然可能把正确的部署命令找回来。

EN: Mem0 keeps memory scoped per user, so shared infrastructure does not automatically imply shared memory.
ZH: Mem0 仍然会按用户隔离记忆，因此共用基础设施并不等于记忆混在一起。

EN: It also avoids the 32 KiB instruction ceiling that constrains `AGENTS.md`.
ZH: 它也绕开了 `AGENTS.md` 那个 32 KiB 指令上限带来的限制。

EN: Finally, it provides a memory option in regions where Codex's native Memories is not yet available.
ZH: 最后，它还为原生 Memories 尚未开放的地区提供了一个替代的 memory 方案。

EN: The real takeaway is not that Codex's memory design is bad, but that it is intentionally narrow and local-first.
ZH: 这篇文章真正的重点并不是说 Codex 的 memory 设计不好，而是它本来就是一种刻意收窄、以本地为中心的设计。

EN: `AGENTS.md` gives stable instructions, and native Memories gives lightweight generated continuity.
ZH: `AGENTS.md` 负责提供稳定指令，原生 Memories 负责提供轻量的自动连续性。

EN: But once users want portability, semantic recall, or cross-tool continuity, they need another layer.
ZH: 但只要用户开始需要可迁移性、语义召回，或者跨工具连续性，就会自然需要另一层系统来补位。

EN: That is the role Mem0 is claiming in the Codex ecosystem.
ZH: 这正是 Mem0 想在 Codex 生态里占据的位置。