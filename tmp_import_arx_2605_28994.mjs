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
const title = 'Benchmarking and Evaluating AI for Modeling and Simulation';
const url = 'https://arxiv.org/abs/2605.28994';
const tags = ['Modeling & Simulation', 'AI Evaluation', 'Benchmarks'];
const summary = '这篇论文介绍了 BEAMS（Benchmarking and Evaluating AI for Modeling and Simulation）倡议，目标是为“用 AI 支持建模与仿真”建立一套更负责任、以人为中心的评测框架。作者的核心观点是：真正能用于现实决策支持的 AI，不只是会聊天或生成文字，还需要能帮助人类构建 simulation model、解释这些模型、迭代修正模型，并在这个过程中补充而不是替代人的建模专业知识。论文的贡献更偏基础设施和评测方法：一方面提出了开放协作的数字/组织机制，另一方面已经实现了一批自动化测试，用于评估 AI 在因果翻译、模型迭代、因果推理、行为解释、建模步骤建议和错误修复建议等任务上的表现。根据摘要，当前 AI 工具在讨论型任务与基础定性任务上表现更好，但在因果推理和定量纠错上仍明显较弱，而且不同 LLM 在不同 engine/task 组合上没有绝对统治者。这意味着建模仿真领域的 AI 评估不能只看通用 benchmark 分数，而要看具体任务、速度/准确率权衡，以及是否真正服务于 human-centered modeling workflow。\n\n注：本条目基于 arXiv 摘要页信息整理；该论文当前没有可用 HTML 正文，未按全文导入。';

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
blocks.push(heading('核心内容'));

const pairs = [
  [
    'The paper argues that AI tools intended to support real-world decision making must be able to help build simulation models and make those models interpretable, rather than merely generate plausible text outputs.',
    '论文认为，真正要服务现实决策的 AI 工具，必须能够帮助构建 simulation model，并让模型结果可解释，而不是只会生成看起来合理的文本。'
  ],
  [
    'A central principle is that AI should complement human modeling expertise rather than replace it. The target is human-centered modeling and simulation practice.',
    '作者把“AI 补充人类建模能力，而不是替代人类专家”当成核心原则，整个评测体系也围绕 human-centered modeling and simulation practice 来设计。'
  ],
  [
    'To support that goal, the BEAMS Initiative is building benchmarks, open infrastructure, and an open-source project called sd-ai so that evaluation of modeling-and-simulation AI tools can be transparent and collaborative.',
    '为了实现这个目标，BEAMS 倡议不仅提出 benchmark，还建设开放的数字基础设施和开源 sd-ai 项目，使建模与仿真 AI 工具的评估过程能够透明、可协作。'
  ],
  [
    'Organizationally, the initiative separates responsibilities: a steering group prioritizes benchmark directions, while a technical group implements the benchmarks as automated tests.',
    '在组织层面，这个倡议也做了分工：steering group 负责决定优先做哪些 benchmark，technical group 则负责把这些 benchmark 真正落成自动化测试。'
  ],
  [
    'The implemented evaluations span multiple categories, including causal translation, model iteration, causal reasoning, conformance, model behavior explanation, suggested model-building steps, and suggested model fixes.',
    '目前已经实现的评测维度覆盖多个类别，包括因果翻译、模型迭代、因果推理、一致性/符合性、模型行为解释、建模步骤建议，以及模型修复建议。'
  ],
  [
    'These tests are applied to AI tools that support qualitative model building, quantitative model building, and model discussion, which makes the benchmark broader than a single prompting or code-generation task.',
    '这些测试并不是只针对某一种 prompt 或代码生成任务，而是应用在支持定性建模、定量建模以及模型讨论的 AI 工具上，因此评测面向的是完整工作流中的多类能力。'
  ],
  [
    'One notable finding is that when the same sd-ai engines are paired with different LLMs, performance varies significantly. No single LLM dominates across all engine types and tasks.',
    '摘要里一个很关键的观察是：即便底层 engine 不变，只是切换不同 LLM，性能表现也会明显变化；而且没有任何单一 LLM 能在所有 engine 类型和任务上全面领先。'
  ],
  [
    'The current generation of AI-enabled modeling tools performs relatively better in discussion-oriented tasks and basic qualitative tasks than in causal reasoning and quantitative error fixing.',
    '当前这一代 AI 建模工具，在讨论型任务和基础定性任务上的表现相对更好，但在因果推理和定量错误修复上仍然偏弱。'
  ],
  [
    'This suggests that evaluation in the modeling-and-simulation domain should be task-specific and should pay attention to tradeoffs between speed and accuracy, rather than assuming general LLM strength transfers uniformly.',
    '这意味着，在建模与仿真领域做 AI 评估时，必须是任务特定的，并且要看速度与准确率之间的权衡，不能假设通用 LLM 能力会平均迁移到所有 modeling task 上。'
  ],
  [
    'The initiative is also trying to incorporate benchmarks that address bias, alternative perspectives, and broader human-centered use cases, indicating that evaluation is treated as both a technical and socio-technical problem.',
    '作者还在推进能够处理偏见、替代视角以及更广义 human-centered use case 的 benchmark，说明他们把评测看成既是技术问题，也是社会技术问题。'
  ]
];

for (const [en, zh] of pairs) {
  blocks.push(paragraph('EN: ' + en, 'blue'));
  blocks.push(paragraph('ZH: ' + zh, 'green'));
}

blocks.push(heading('我的判断'));
blocks.push(paragraph('这篇论文的价值不在提出某个单一新模型，而在于把“建模与仿真中的 AI 评测”系统化。它特别适合作为研究/产品团队设计 domain-specific evaluation framework 的参考：如果你的 AI 系统目标不是纯问答，而是支持分析、推演、决策和模型迭代，那么这篇文章提醒你，benchmark 应该围绕工作流、解释性、人机协作和修错能力来设计。', 'default'));
blocks.push(paragraph('同时也要注意：当前条目基于摘要而非全文，适合做方向判断和主题归档，不适合当作完整技术细节来源。', 'default'));

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
