Codex /goal: OpenAI's 'Ralph Loop' Feature That Ran a Device Driver Project for 14 Hours Without Stopping

这篇文章真正想说明的，不是 Codex 多了一个 `/goal` 命令，而是 coding agent 的交互范式正在从“你提一句、它答一句”的事务型模式，转向“你定义目标、它持续迭代直到完成”的持久循环模式。作者借 Andrew Chen 让 Codex 在低层设备驱动项目上连续跑 14 小时的例子，强调这是一种质变：用户不再需要在每个中间步骤里充当调度器，而是把目标交给 agent，让它自己去计划、执行、观察、修正、再执行。文章同时很实际地指出，`/goal` 并不是魔法，它是否有用高度依赖于三个前提：目标必须可验证、仓库上下文必须足够清晰、以及你必须对 token 成本和边界条件有清醒认知。换句话说，`/goal` 的价值不在于“更自动”，而在于“把长期自主循环变成一种可操作、可检查、可复用的工程能力”。

EN: The article frames `/goal` as a qualitative shift in how people use coding agents.
ZH: 文章把 `/goal` 描绘成 coding agent 使用方式上的一次质变。

EN: Instead of a transactional prompt-response workflow, `/goal` enables a persistent objective-driven loop.
ZH: 它让交互方式从事务型的“一问一答”变成围绕目标持续运行的循环。

EN: The emblematic example is Andrew Chen leaving Codex running overnight on a low-level driver project for 14 hours.
ZH: 文中最具代表性的例子，是 Andrew Chen 把 Codex 丢给一个低层驱动项目，让它自己连续跑了 14 个小时。

EN: The point is not that this is a benchmark, but that it changes the default relationship between user and agent.
ZH: 重点不在于这是不是一个 benchmark，而在于它改变了用户和 agent 的默认协作关系。

EN: Philip Corey from the Codex team describes `/goal` as OpenAI's take on the Ralph loop: keep a goal alive across turns and do not stop until it is achieved.
ZH: Codex 团队的 Philip Corey 把 `/goal` 定义为 OpenAI 对 Ralph loop 的实现：跨回合持续保持目标，直到完成前都不停下来。

EN: Standard Codex sessions are stateful but still reactive.
ZH: 标准 Codex 会话虽然有状态，但本质上依旧是被动响应式的。

EN: The user asks, the system responds, and the user must correct, redirect, or continue the process step by step.
ZH: 用户提问，系统回应，然后用户要不断纠正、重定向或推进下一步。

EN: The Ralph loop changes that by having the agent act, observe, and decide the next step on its own.
ZH: Ralph loop 改变了这一点：agent 会自己行动、观察结果，并决定下一步。

EN: In practice, `/goal` makes Codex plan, execute, inspect outcomes, and re-plan repeatedly without waiting for user permission at every step.
ZH: 在实际运行里，`/goal` 让 Codex 不断地规划、执行、检查结果、再规划，而不必每一步都等用户批准。

EN: That means it can spawn subprocesses, write code, run tests, inspect failures, and try again autonomously.
ZH: 也就是说，它可以自己拉起子进程、写代码、跑测试、分析错误并重试。

EN: Alex Finn summarizes the feature bluntly: you give the agent a mission and it can keep working for days.
ZH: Alex Finn 对这个特性的概括很直接：你给它一个任务，它真的可以连着工作几天。

EN: This autonomy comes with a cost: token consumption rises dramatically.
ZH: 但这种自治会带来明显代价：token 消耗会大幅上升。

EN: Andrew Chen's “10,000x token use” comment is presented not as hype, but as the natural arithmetic of long-running autonomous sessions.
ZH: Andrew Chen 所说的“10,000 倍 token 消耗”在文中并不是夸张说法，而是长时自治运行的自然结果。

EN: A short human-supervised session may consume a few hundred thousand tokens, while a multi-hour unattended loop can use orders of magnitude more.
ZH: 一个有人盯着的短会话可能只花几十万 token，而一个多小时无人值守循环会高出几个数量级。

EN: The article emphasizes that `/goal` is only available in the Codex CLI, not the web UI.
ZH: 文章也强调，`/goal` 只能在 Codex CLI 中使用，而不是网页界面。

EN: It also works best when the repository gives the agent enough structure and context to reason effectively.
ZH: 同时，它最适合运行在那些能为 agent 提供足够结构和上下文的代码仓库里。

EN: A blank repo with a vague instruction is a recipe for confident nonsense.
ZH: 一个空仓库再配上模糊指令，几乎就是让 agent 充满自信地胡来。

EN: Existing files, tests, and documentation help the loop stay grounded.
ZH: 已有代码、测试和文档则能帮助这个循环保持在正确轨道上。

EN: If the task needs special capabilities like image generation, those skills must be installed before the run starts.
ZH: 如果任务依赖某些特殊能力，比如生成图片，对应 skill 也必须在开跑前先装好。

EN: The agent cannot reliably discover and provision all missing tools mid-run.
ZH: agent 不能指望在长循环中途再稳定地把缺失工具都补齐。

EN: A central claim of the article is that prompt design matters more for `/goal` than most users think.
ZH: 文章的一个核心判断是：对 `/goal` 来说，prompt 设计的重要性比多数人以为的更高。

EN: Alex Finn argues that most hand-written `/goal` prompts are not good enough.
ZH: Alex Finn 甚至认为，大多数人自己手写的 `/goal` prompt 都不够好。

EN: His recommendation is to use another AI system to generate the `/goal` prompt.
ZH: 他的建议是，先用另一个 AI 帮你生成 `/goal` prompt。

EN: The planning model should first understand the project and then propose several concrete `/goal` options with detailed prompts.
ZH: 也就是让一个更擅长规划的模型先理解项目，再给出几个具体的 `/goal` 方案和详细提示词。

EN: The underlying logic is that a separate planner can reason about scope, verifiable end states, and checkpoints more effectively than a human improvising in the terminal.
ZH: 背后的逻辑是：一个独立的规划模型，比人在终端里临场发挥，更擅长思考范围、可验证结束条件和检查点。

EN: The article treats this as a form of meta-prompting.
ZH: 文中把这种做法视为一种 meta-prompting。

EN: A good `/goal` prompt must define what “done” means before execution begins.
ZH: 一个好的 `/goal` prompt 必须在执行前就定义清楚什么叫“完成”。

EN: A vague prompt like “improve the codebase” has no terminal state and invites drift.
ZH: 像“改进代码库”这种模糊 prompt 没有终止状态，只会引来目标漂移。

EN: A useful prompt instead specifies a bounded output, a verification method, and a clear scope.
ZH: 真正有用的 prompt 则会明确输出物、验证方式和边界范围。

EN: The article's example is a prompt like implementing OAuth2 login, adding passing integration tests, and updating the README.
ZH: 文中举的例子就是：实现 OAuth2 登录、补齐能通过的集成测试，并更新 README。

EN: This gives the agent a verifiable terminal condition.
ZH: 这样 agent 才能拥有一个可验证的终止条件。

EN: Once the run starts, the author advises users to actually leave it alone.
ZH: 一旦运行开始，作者建议用户真的要学会“放手”。

EN: If you constantly intervene, the session collapses back into normal interactive coding.
ZH: 如果你频繁插手，这个会话就会重新塌回普通的交互式编码模式。

EN: The right posture is periodic inspection for genuine blockers, not constant micromanagement.
ZH: 正确姿势是隔几个小时检查一次有没有真正阻塞，而不是持续盯盘式微操。

EN: When evaluating the results, the article says to review the output as a diff, not as a conversation transcript.
ZH: 在结果评估上，文章强调应该把产出当成 diff 来审，而不是只看一段对话总结。

EN: Users should run tests, inspect file changes, and verify the work like they would review a pull request.
ZH: 你应该像审 PR 一样去跑测试、看改动、验证结果。

EN: This makes the “persistent, inspectable, verifiable” principle operational rather than rhetorical.
ZH: 这让“持久、可检查、可验证”这套原则从口号变成了实际操作方法。

EN: The article also catalogues the main failure modes.
ZH: 文章还系统列出了几种主要失败模式。

EN: The first is vague goals that let the agent confidently solve the wrong problem.
ZH: 第一种是目标太模糊，导致 agent 充满自信地解决了错误的问题。

EN: Because `/goal` does not naturally pause for clarification, ambiguity compounds over time.
ZH: 因为 `/goal` 不会天然停下来请求澄清，所以歧义会在长时间运行中不断放大。

EN: Another failure mode is missing context in the repository.
ZH: 另一种失败模式是仓库上下文不够完整。

EN: If Codex cannot read the right files or infer the project structure, it fills the gaps with assumptions.
ZH: 如果 Codex 读不到关键文件、也推不清项目结构，它就会用假设来填补空白。

EN: Over long loops, those assumptions can compound into a large amount of wasted work.
ZH: 在长循环里，这些假设会层层叠加，最终变成大量无效劳动。

EN: Token spend surprises are another major risk.
ZH: token 成本失控是另一个重大风险。

EN: The article recommends setting hard budget limits before launching long unattended runs.
ZH: 文章建议在启动长时无人值守任务前，先设好硬预算上限。

EN: Browser-related tasks are also risky because Codex's Chrome plugin is still unstable.
ZH: 涉及浏览器自动化的任务也有额外风险，因为 Codex 的 Chrome 插件当时还不稳定。

EN: At launch it could be blocked by extension UI interference, making browser-in-the-loop goals brittle.
ZH: 在发布初期，它甚至会被扩展 UI 挡住，这让依赖浏览器的 `/goal` 任务变得很脆弱。

EN: The article places `/goal` inside a wider industry shift toward persistent agents.
ZH: 文章还把 `/goal` 放进了更大的行业趋势中来看。

EN: Cursor's `/orchestrate` and Claude's managed agents are cited as similar moves toward longer-running, more autonomous agent workflows.
ZH: 文中提到 Cursor 的 `/orchestrate` 和 Claude 的 managed agents，都代表着向更长时、更自治 agent 工作流的同一方向演化。

EN: The shared pattern is agents that observe their own outputs and continue acting without needing a human prompt between every step.
ZH: 它们共享的模式是：agent 能观察自己的产出，并在不需要人类逐步提示的情况下持续行动。

EN: This is different from traditional agentic workflow chains that are still human-orchestrated at the macro level.
ZH: 这和传统那种虽然“agentic”但在宏观层面仍然由人手工编排的 workflow chain 不一样。

EN: `/goal` pushes more of the orchestration into the agent itself.
ZH: `/goal` 是把更多编排权真正推回 agent 自身。

EN: The user defines the outcome, but the agent determines the path.
ZH: 用户定义结果，而 agent 自己寻找路径。

EN: The article connects this to Karpathy-style autonomous experiment loops and overnight optimization.
ZH: 文章还把它和 Karpathy 式的自治实验循环、夜间持续优化联系起来。

EN: In that framing, `/goal` is not just a convenience feature but an infrastructure primitive for persistent AI work.
ZH: 在这个视角下，`/goal` 不是一个方便的小命令，而是一种支撑持久 AI 工作的新型基础能力。

EN: The final practical recommendation is to try `/goal` on one real project that is large enough to benefit from long-form autonomy.
ZH: 作者最后的实操建议是：找一个真正够大的项目，去亲手试一次 `/goal`。

EN: Not something trivial, but a feature, refactor, or test suite you have been postponing because it is too large for a normal session.
ZH: 不要拿太琐碎的任务试，而要挑那种因为规模太大、你一直拖着没做的 feature、重构或测试建设任务。

EN: The deepest takeaway is that the key shift is not better answers, but disappearing session boundaries.
ZH: 这篇文章最深的一层启发是：真正的变化不在于 agent 回答得更好，而在于“会话边界正在消失”。

EN: The coding agents that matter next are not the ones that answer quickly, but the ones that keep working while you sleep.
ZH: 下一阶段真正重要的 coding agent，不是回答更快的那类，而是你睡觉时它还在持续干活的那类。