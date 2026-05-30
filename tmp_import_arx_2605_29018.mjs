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
const title = 'Adopt ≠ Adapt: Longitudinal Analyses of LLM Conversations in the Wild';
const url = 'https://arxiv.org/abs/2605.29018';
const tags = ['LLM Users', 'User Behavior', 'Microsoft'];
const summary = '这篇论文研究的不是“人们如何使用 LLM”的静态横截面，而是“同一个用户会不会随着时间变得更会用 LLM”。作者基于约 1.2 万名 Microsoft Bing Copilot 用户的六个月对话轨迹，并与 WildChat-4.8M 做对照，得出的核心结论很有冲击力：总体人群层面确实能看到用户越来越会提复杂任务、对话更长、完成率更高，但这些变化并不主要来自单个用户在学习和适应，而更多来自后进入系统的新用户本来就更像‘高阶用户’。换句话说，用户是 adopt 了 LLM，但未必真的 adapt 了自己的使用方式；个人习惯高度粘滞。论文还指出，活跃用户与普通用户差异极大：前者更容易完成任务、输入更复杂、任务更偏专业；而常被广泛拿来研究用户行为的 WildChat 数据则明显偏向高熟练度 power users，不能代表典型大众用户。对做 AI 产品、用户研究和数据集构建的人来说，这篇文章的重要性在于：不能把 population trend 误读为 individual learning，也不能把 WildChat 这类公开数据当作真实平均用户的直接代理。';

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

function heading(text, level = 2) {
  const key = level === 1 ? 'heading_1' : level === 3 ? 'heading_3' : 'heading_2';
  return {
    object: 'block',
    type: key,
    [key]: {
      rich_text: [{ type: 'text', text: { content: text.slice(0, 1800) } }]
    }
  };
}

const blocks = [];
blocks.push(paragraph(summary, 'default'));
blocks.push(heading('核心发现'));

const pairs = [
  [
    'The paper asks a longitudinal question that most prior work avoids: not just how people use LLMs overall, but whether individual users actually change how they use LLMs over time.',
    '这篇论文提出的是一个很多既有研究回避的纵向问题：不只是“人们总体如何使用 LLM”，而是“单个用户会不会随着时间真正改变自己的使用方式”。'
  ],
  [
    'To study this, the authors analyze roughly six months of trajectories from about 12,000 randomly sampled Microsoft Bing Copilot users, alongside a larger population-level sample of daily conversations.',
    '为了解答这个问题，作者分析了大约 1.2 万名随机抽样的 Microsoft Bing Copilot 用户在约六个月内的完整对话轨迹，同时还结合了更大的日级 population sample 来观察群体趋势。'
  ],
  [
    'They also replicate the analysis on WildChat-4.8M so they can compare a private mainstream consumer assistant dataset with a widely used public conversation dataset.',
    '他们还把同样的分析方法复制到了 WildChat-4.8M 上，这样就可以把一个私有的大众消费级助手数据集，与一个被广泛使用的公开对话数据集直接对照起来。'
  ],
  [
    'The headline result is that population-level trends exist, but individual-level adaptation is much weaker. User habits are overwhelmingly sticky.',
    '最关键的结论是：群体层面的趋势确实存在，但个人层面的适应要弱得多。用户的使用习惯表现出非常强的粘滞性。'
  ],
  [
    'At the aggregate level, Bing Copilot users appear to become more active, send more linguistically complex messages, complete more tasks, and shift toward more open-ended and sophisticated intents over time.',
    '在总体层面上，Bing Copilot 用户似乎会随着时间变得更活跃、输入更复杂、任务完成率更高，而且任务意图也逐渐从简单查询转向更开放、更复杂的用途。'
  ],
  [
    'However, when the authors track individual users over time, they find that these changes are not mainly caused by a given person learning to use the system better. Instead, users who later become highly active already look different very early in their trajectories.',
    '但当作者真正去追踪单个用户的时间轨迹时，他们发现这些变化并不主要来自某个人在持续学习如何更好地使用系统。相反，那些后来会成为高活跃用户的人，在轨迹一开始就已经和普通用户很不一样了。'
  ],
  [
    'This is why the title says “Adopt ≠ Adapt”: people may adopt LLM tools, yet not substantially adapt their own habits through ordinary use.',
    '这也是标题“Adopt ≠ Adapt”的含义：人们可以采用 LLM 工具，但并不意味着他们会在日常使用中显著改变自己的行为模式。'
  ],
  [
    'The paper further stratifies users by activity level and finds stark differences between low-, medium-, and high-activity groups. Highly active users have more successful conversations and are more likely to pursue complex, professionally oriented tasks.',
    '论文进一步按活跃度对用户分层，发现低、中、高活跃用户之间存在非常明显的差异。高活跃用户更容易获得成功对话，也更倾向于把 LLM 用在更复杂、更偏专业化的任务上。'
  ],
  [
    'They also tend to write messages with greater linguistic complexity, which suggests that “power users” are not just using the tool more often but using it in qualitatively different ways.',
    '这些高活跃用户通常也会写出语言复杂度更高的输入，这说明 power users 不只是“更常用”，而是在使用方式上就已经和普通用户呈现出质的不同。'
  ],
  [
    'The WildChat comparison is especially important. Some broad trends show up there too, but the authors find that WildChat is heavily skewed toward highly proficient users and contains substantial API-like, non-natural conversational usage.',
    'WildChat 的对照尤其重要。虽然那里也能看到一些宏观趋势，但作者发现 WildChat 明显偏向高熟练度用户，而且包含大量类似 API 批处理而非自然对话的使用模式。'
  ],
  [
    'As a result, WildChat does not represent typical everyday user–AI interaction, which is a major caveat for anyone using it to study user behavior, build benchmarks, or fine-tune models.',
    '因此，WildChat 并不能代表典型的日常 user–AI interaction。对于任何想用它研究用户行为、构建 benchmark 或微调模型的人来说，这都是一个非常重要的限制条件。'
  ],
  [
    'Methodologically, the paper is also a reminder that population-level temporal trends can be misleading. Aggregate improvement over time should not automatically be interpreted as evidence that individuals are learning.',
    '从方法论上说，这篇论文也提醒我们：群体层面的时间趋势很容易产生误导。总体指标随时间变好，并不能自动被解释成“个体在学习”。'
  ],
  [
    'Instead, aggregate trends may be driven by cohort effects, selection effects, or changes in who enters and stays in the system.',
    '很多时候，群体趋势可能只是 cohort effect、selection effect，或者进入并留在系统中的用户群体本身发生了变化。'
  ],
  [
    'The authors argue that if habits are sticky, users may not discover better ways to use LLMs through natural exploration alone. That implies a need for proactive product interventions.',
    '作者进一步指出，如果用户习惯本身高度粘滞，那么光靠自然探索，很多用户并不会自己发现更有效的使用方式。这意味着产品层面需要更主动的引导和干预。'
  ],
  [
    'This has practical implications for AI product design: onboarding, task scaffolding, exemplars, and workflow-specific guidance may matter more than simply waiting for users to “learn the product.”',
    '这对 AI 产品设计很有现实意义：onboarding、任务脚手架、示例提示和工作流导向指导，可能比“等用户自己学会怎么用”重要得多。'
  ],
  [
    'It also matters for evaluation. If user populations are heterogeneous and public datasets over-represent experts, then systems optimized on those datasets may systematically miss the needs of average users.',
    '这对评测也同样关键：如果用户群体高度异质，而公开数据集又系统性地高估专家型用户，那么基于这些数据优化出来的系统，就可能持续偏离普通用户真正的需求。'
  ],
  [
    'In that sense, this paper is not just about conversation analytics. It is really about the difference between measuring adoption and measuring behavioral adaptation, and about the dangers of treating public chat corpora as faithful mirrors of the real world.',
    '从这个角度看，这篇论文不只是关于对话分析。它真正讨论的是“衡量 adoption”和“衡量行为 adaptation”之间的差别，以及把公开聊天语料误当成真实世界镜像的风险。'
  ]
];

for (const [en, zh] of pairs) {
  blocks.push(paragraph('EN: ' + en, 'blue'));
  blocks.push(paragraph('ZH: ' + zh, 'green'));
}

blocks.push(heading('我的判断'));
blocks.push(paragraph('这篇文章很适合收进 AI 产品研究/用户研究知识库，因为它直接挑战了一个常见但很少被认真检验的假设：用户会随着使用自然成长为更熟练的 prompt user。作者给出的答案更接近“不会，至少不会明显发生在大多数个体身上”。这对做 agent、copilot、企业 AI 助手的人尤其重要：如果你看到总体指标变好，先别急着归功于产品教育成功，也许只是新一批更会用的人来了。', 'default'));
blocks.push(paragraph('另一方面，这篇论文对 WildChat 一类公开数据集的代表性提出了很强的警告。以后凡是看到基于 WildChat 做“真实用户行为”论断的工作，都值得多留一个心眼：它更像是高熟练度用户和半 API 化用法的混合样本，而不是平均用户画像。', 'default'));

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
