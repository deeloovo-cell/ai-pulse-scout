#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const notionApiDir = '/Users/aactest/Desktop/skills/notion-api';
const envPath = path.join(notionApiDir, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { NotionClient } = await import('/Users/aactest/Desktop/skills/notion-api/notion-client.js');
const notion = new NotionClient();

const databaseId = 'e9c722ff-034b-4062-9f9d-555cdd87b136';
const title = 'DynoSim: Simulating the Pareto Frontier';
const url = 'https://developer.nvidia.com/blog/dynosim-simulating-the-pareto-frontier/';
const tags = ['LLM Serving', 'Simulation', 'NVIDIA'];
const summary = '这篇 NVIDIA 技术博客介绍了 DynoSim——一个面向 LLM serving 的离散事件仿真系统，用来给 Dynamo 推理栈做“数字孪生”。它把请求回放、单引擎调度、Router、Planner、KV 缓存/迁移以及硬件计时统一到同一条虚拟时间线上，从而在不真正烧 GPU 的前提下，快速评估部署参数、路由策略、缓存层级和自动扩缩容策略对吞吐、TTFT、TPOT 和成本的影响。文章最核心的价值不只是“更快地做 benchmark”，而是把仿真变成 LLM 基础设施优化的内环：先在仿真里搜索 Pareto frontier、筛掉差方案，再把少数候选放到真实集群验证。对做推理平台、调度器、缓存系统和自动化运维的人来说，DynoSim 提供的是一种把系统研究、参数搜索和在线策略改进系统化的方法论。';

function paragraph(text, color = 'default') {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: text.slice(0, 1900) },
        annotations: { color }
      }]
    }
  };
}

const blocks = [];
blocks.push(paragraph(summary, 'default'));

const pairs = [
  [
    'Modern LLM serving is difficult to tune because every deployment is a stack of interdependent choices: backend, tensor-parallel shape, prefill/decode split, worker counts, scheduler configuration, routing policy, KV cache behavior, autoscaling thresholds, and topology.',
    '现代 LLM 服务之所以难调优，是因为一次部署并不是调一个参数，而是一整套彼此耦合的选择：推理后端、张量并行形状、prefill/decode 拆分、worker 数量、调度器配置、路由策略、KV cache 行为、自动扩缩容阈值以及底层拓扑。'
  ],
  [
    'A local improvement at one layer often just moves the bottleneck somewhere else, and for large models even one realistic experiment can consume many GPUs or nodes before engineers learn whether the idea was worth trying.',
    '某一层的局部优化，往往只是把瓶颈挪到别处；而对大模型来说，即便只做一次接近真实场景的实验，也可能要耗掉很多 GPU 或节点，才能知道这个想法值不值得继续试。'
  ],
  [
    'That is the motivation for DynoSim: a workload-driven discrete-event simulation of the NVIDIA Dynamo serving stack, intended as a digital twin rather than a purely analytical model or a bit-exact hardware emulator.',
    'DynoSim 的出发点就在这里：它是一个由工作负载驱动的离散事件仿真系统，目标是成为 NVIDIA Dynamo serving stack 的“数字孪生”，而不是纯解析模型，也不是位级精确的硬件模拟器。'
  ],
  [
    'DynoSim combines measured engine forward-pass timing, Mocker scheduler cores, Router and Planner behavior, KV cache effects, and workload traces on one virtual timeline so that component decisions can influence one another causally.',
    'DynoSim 把测量得到的引擎 forward-pass 计时、Mocker 调度核心、Router 与 Planner 行为、KV cache 效应以及 workload trace 全部放到同一条虚拟时间线上，让各个组件的决策可以真实地相互影响。'
  ],
  [
    'The system is implemented in Rust and is extremely fast: on an Apple M4 MacBook Air, an offline replay of the full 23,608-request Mooncake trace simulated a 60.1-minute serving window in 2.41 seconds of wall-clock time, about 1,500 times faster than real time.',
    '整个系统用 Rust 实现，速度非常夸张：文章给出的例子是在一台 Apple M4 MacBook Air 上，离线回放完整的 23,608 条 Mooncake trace，请求窗口本来覆盖 60.1 分钟，但仿真只花了 2.41 秒，差不多是实时的 1,500 倍。'
  ],
  [
    'With that speed, DynoSim can turn deployment search into a simulate-then-verify loop, mapping the Pareto frontier for a workload and screening thousands of candidates before real GPU time is spent.',
    '有了这个速度之后，部署搜索就能从“真机上一个个试”变成“先仿真、后验证”的闭环：先在仿真里为某个 workload 画出 Pareto frontier，筛掉成千上万种不优方案，再把少数候选拿去真实 GPU 上验证。'
  ],
  [
    'Architecturally, DynoSim is compositional rather than monolithic: a replay harness drives workload arrivals, single-engine simulations model worker-local scheduling and forward-pass timing, and multi-engine simulations add cross-worker behaviors such as routing, distributed caching, and planner actions.',
    '在架构上，DynoSim 采用的是组合式设计，而不是一个大一统黑盒：回放框架负责驱动请求到达，单引擎仿真负责 worker 本地的调度与 forward-pass 计时，而多引擎仿真则补上跨 worker 的系统行为，比如路由、分布式缓存和 Planner 动作。'
  ],
  [
    'Because it is a discrete-event simulation, components do not wait in real time. They schedule future events such as request arrivals, scheduler steps, forward passes, KV transfers, worker startups, or planner decisions, and the runtime simply jumps to the next timestamp.',
    '由于底层是离散事件仿真，系统中的组件并不会真的“等时间流逝”。它们只是在事件队列里安排未来事件，比如请求到达、调度步进、forward pass、KV 传输、worker 启动或 Planner 决策，而运行时只需要不断跳到下一个时间戳。'
  ],
  [
    'A request journey therefore becomes explicit: the load generator emits a request, the router decides placement, the engine scheduler places it into prefill or decode, hardware-informed timing estimates pass duration, possible KV events are added, visible output tokens are produced, and the collector records metrics.',
    '因此，一次请求在系统中的旅程会被清楚地展开：负载生成器发出请求，router 决定它去哪，engine scheduler 把它放进 prefill 或 decode，硬件感知的计时模型估计这一步要多久，必要时再加上 KV 相关事件，随后才产生可见输出 token，并由采集器记录指标。'
  ],
  [
    'The article stresses that scheduler fidelity matters. A single engine cannot be reduced to a rough tokens-per-second number because batching, waiting/running queues, chunked prefill, preemption, recompute, radix-cache admission, and decode retraction materially affect TTFT and system behavior under concurrency.',
    '文章特别强调，调度器层面的保真度非常关键。单个引擎不能被粗暴地简化成一个 tokens-per-second 数字，因为 batching、waiting/running 队列、chunked prefill、抢占与重算、radix cache 准入以及 decode retraction，都会在高并发下显著改变 TTFT 和整体系统行为。'
  ],
  [
    'AI Configurator (AIC) provides the engine-side timing model: given model, backend, system, tensor-parallel shape, and pass shape, it estimates how long a prefill or decode pass should take. DynoSim then wraps that timing with serving behavior.',
    'AI Configurator（AIC）在这里承担的是引擎侧计时模型的角色：给定模型、后端、系统、张量并行形状和 pass 形状，它估计一次 prefill 或 decode 大概要多久，而 DynoSim 则在这层计时之上补齐服务行为本身。'
  ],
  [
    'The multi-engine layer is where system-level feedback loops emerge. A Router needs to know current cache state and decode load; a Planner needs traffic, worker state, and SLA signals; KVBM needs transfer pressure, tier capacity, and expected future cache availability.',
    '多引擎层则是系统级反馈环真正浮现的地方。Router 需要看到当前 cache 状态和 decode 负载；Planner 需要根据流量、worker 状态和 SLA 信号做决定；KVBM 则要考虑传输压力、分层容量以及未来 cache 可用性。'
  ],
  [
    'By putting all of those on the same timestamp-ordered event queue, DynoSim can model how one online decision changes downstream queueing, scheduling, cache state, and future routing possibilities.',
    '把这些全部放进同一条按时间排序的事件队列后，DynoSim 就能刻画“一个在线决策如何改变后续排队、调度、缓存状态以及未来路由空间”这样的因果链。'
  ],
  [
    'The article gives a concrete Router example using the Mooncake FAST25 toolagent trace with MiniMax-M2.5 FP8 on HGX B200 and vLLM timing. Compared with round-robin routing, KV-aware routing increases prefix reuse from roughly 0.38 to about 0.44–0.45, lowers TTFT, and improves throughput, though at high concurrency it can raise decode pressure.',
    '文章给了一个很具体的 Router 例子：在 Mooncake FAST25 toolagent trace、MiniMax-M2.5 FP8、HGX B200 和 vLLM 计时设定下，相比 round-robin，KV-aware routing 能把 prefix reuse 从大约 0.38 提高到 0.44–0.45，同时降低 TTFT、提升吞吐；但代价是在高并发下可能会增加 decode 压力。'
  ],
  [
    'For KVBM, the simulation models local and remote KV hierarchy behavior including GPU memory, host memory, SSD, and distributed cache, all as timing and resource-pressure events on the same timeline.',
    '在 KVBM 部分，仿真会把本地与远端的 KV 分层都纳入模型，包括 GPU memory、host memory、SSD 和分布式缓存，而且都作为同一条时间线上的时延与资源压力事件处理。'
  ],
  [
    'When the G2 host-memory tier is enabled and sized at 32,768 blocks, the mocker predicts less prefill recompute, lower TTFT across the sweep, and an upward shift in the throughput-versus-interactivity Pareto curve, with the largest gain at concurrency 32.',
    '当 G2 host-memory tier 被开启并设置为 32,768 blocks 时，模拟结果显示 prefill 重算减少，整个 sweep 中的 TTFT 都下降，吞吐与交互性的 Pareto 曲线整体上移，其中在并发度 32 时收益最大。'
  ],
  [
    'Once replay becomes a reliable scoring function, DynoSim can serve both optimization and discovery. The current optimizer uses a pragmatic block-coordinate descent over TP shape, worker split, and router settings, but the same replay loop could be attached to Bayesian optimization, genetic search, or Vizier-like black-box search.',
    '当 replay 可以稳定充当评分函数之后，DynoSim 就同时具备“优化”和“发现”两类用途。当前优化器使用的是相对朴素但实用的 block-coordinate descent，在 TP 形状、worker 划分和 router 参数上逐块搜索；但同一套 replay loop 也完全可以接到贝叶斯优化、遗传搜索或 Vizier 风格的黑盒搜索上。'
  ],
  [
    'The article goes further and suggests an autoresearch-style workflow: an agentic harness could propose nontrivial code changes, rebuild Dynamo, rerun the trace, and keep only changes that improve the objective, effectively turning replay into a bounded research loop for system components.',
    '文章甚至更进一步，提出了一种 autoresearch 风格的流程：让一个 agentic harness 自动提出非平凡代码修改、重建 Dynamo、重新跑 trace，并且只保留那些真正改善目标函数的改动。这样一来，replay 不只是调参工具，而是变成一个受约束的系统研究内环。'
  ],
  [
    'As a discovery case study, the blog focuses on the Planner, because autoscaling effects emerge over minutes of traffic, delayed worker startup, capacity churn, and feedback between scaling, queues, and routing—phenomena that are costly to study directly on a full Kubernetes cluster.',
    '在“发现”案例里，文章重点讲的是 Planner，因为自动扩缩容的关键现象会在分钟级流量波动、worker 启动延迟、容量抖动以及 scaling、队列与路由的反馈中逐渐出现，而这些东西如果直接上完整 Kubernetes 集群去研究，成本会非常高。'
  ],
  [
    'Using the same Mooncake trace but a simulated Qwen3-32B profile at TP=2 on H200-SXM, the first experiment compares static deployments against a dynamic SLA-targeted planner. The dynamic deployment reaches a better cost-latency operating point than any static replica count tested.',
    '在相同 Mooncake trace、但切换到 Qwen3-32B、TP=2、H200-SXM 的仿真配置下，第一个实验比较了静态部署与面向 SLA 的动态 Planner。结果显示，动态部署在成本-延迟平衡点上优于所有被测试的静态副本数配置。'
  ],
  [
    'A second experiment sweeps the scaling interval from 1 second to 300 seconds with instant startup. It finds that p90 TTFT stays roughly flat between 1 and 10 seconds while scaling events collapse from 1,529 to 233, suggesting the best tradeoff is around 5–10 seconds.',
    '第二个实验把 scaling interval 从 1 秒扫到 300 秒，并假设启动几乎即时。结果发现，1 到 10 秒之间 p90 TTFT 基本持平，但 scaling 事件数却从 1,529 大幅降到 233，说明最佳折中区间大概在 5–10 秒。'
  ],
  [
    'The third experiment studies cold-start delay. For Qwen3-32B at TP=2, the planner can meet the SLA until startup delay reaches roughly 180 seconds, but around 200 seconds performance falls off a cliff and by 300 seconds the system is trapped behind the burst.',
    '第三个实验研究的是冷启动延迟。对 Qwen3-32B、TP=2 这个设定而言，Planner 在启动延迟约 180 秒以前都还能守住 SLA；但接近 200 秒时性能会出现断崖式恶化，到了 300 秒时系统几乎被突发流量彻底压在后面。'
  ],
  [
    'This is an important practical message: a serving team can use DynoSim to quantify whether engineering effort should go into faster startup, predictive scaling, or pre-warmed capacity before making expensive infrastructure changes.',
    '这给工程团队一个很实用的启发：在真正投入大量基础设施改造之前，可以先用 DynoSim 定量判断究竟应该优先优化冷启动、做预测式扩容，还是准备预热容量。'
  ],
  [
    'The blog is explicit that simulation is meant to be the inner loop, not the final authority. Real clusters remain the outer loop for validation, but simulation lets teams sweep broadly, shortlist Pareto candidates, and then verify only the most promising setups on hardware.',
    '文章也很明确地说，仿真并不是要取代真实集群，而是要成为“内环”。真实集群依然是最后做验证的外环，但仿真可以让团队先大范围扫空间、圈定 Pareto 候选，然后只把最有希望的方案拿到真机上做验证。'
  ],
  [
    'Looking ahead, NVIDIA suggests production telemetry could be fed back into DynoSim continuously so that the system periodically sweeps recently observed traffic and recommends, or even applies, materially better serving configurations as workload shape drifts over time.',
    '往前看，NVIDIA 设想的是把生产遥测持续回灌到 DynoSim 中，让系统定期针对最近观察到的真实流量重新搜索配置空间，并在 workload 形态随着时间漂移时，自动推荐甚至直接应用更优的 serving 配置。'
  ],
  [
    'From a broader infrastructure perspective, DynoSim matters because it reframes LLM serving optimization as a repeatable systems problem. Instead of treating routing, scheduling, caching, scaling, and topology as isolated knobs, it models them as one coupled decision surface and makes that surface explorable.',
    '从更宏观的基础设施视角看，DynoSim 的价值在于它把 LLM serving 优化重新定义成一个可重复、可搜索的系统问题。它不再把路由、调度、缓存、扩缩容和拓扑当作彼此独立的旋钮，而是把它们放到同一个耦合决策面上，并让这个决策面真正变得可探索。'
  ]
];

for (const [en, zh] of pairs) {
  blocks.push(paragraph('EN: ' + en, 'blue'));
  blocks.push(paragraph('ZH: ' + zh, 'green'));
}

const props = {
  '标题': { title: [{ type: 'text', text: { content: title } }] },
  'URL': { url },
  '创建日期': { date: { start: new Date().toISOString() } },
  'Tags': { multi_select: tags.map(name => ({ name })) }
};

const res = await notion.request('/pages', {
  method: 'POST',
  body: JSON.stringify({
    parent: { database_id: databaseId },
    properties: props,
    children: blocks,
  })
});

console.log(JSON.stringify({ id: res.id, url: res.url }, null, 2));
