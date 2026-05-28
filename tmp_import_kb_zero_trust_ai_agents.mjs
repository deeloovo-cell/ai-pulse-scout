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
const title = 'Zero Trust for AI agents';
const url = 'https://claude.com/blog/zero-trust-for-ai-agents';
const tags = ['AI Security', 'Zero Trust', 'Agent Governance'];
const summary = 'Anthropic 这篇文章把“AI 代理安全”放进 Zero Trust 框架里重新定义：问题不只是模型会不会被攻击，而是代理具备目标理解、工具调用、多步执行与上下文记忆后，已经像一类新的半自主执行主体。文章强调，前沿模型正在把“漏洞发现到漏洞利用”的周期从几个月压缩到几小时，因此企业一方面要防 AI 加速攻击，另一方面也要把代理本身纳入身份、权限、记忆与监控体系。其核心主张是：用加密根身份、按任务收缩权限、保护记忆免受污染，并把检测与响应能力提升到足以对抗自治攻击者的速度。';

const blocks = [];

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

blocks.push(paragraph(summary, 'default'));

const pairs = [
  [
    'We share a security framework for deploying autonomous AI agents in the enterprise, covering the new threat landscape, a tiered Zero Trust architecture, and defensive operations built for AI-accelerated attacks.',
    '这篇文章提出了一个面向企业部署自治 AI 代理的安全框架，覆盖新的威胁图景、分层的 Zero Trust 架构，以及针对 AI 加速攻击而设计的防御运营方式。'
  ],
  [
    'Frontier AI models are compressing the timeline between vulnerability and exploit from months to hours. Defenders who adopt these tools find and fix bugs faster; attackers who adopt them, or who simply wait for defenders’ patches and reverse-engineer them into exploits, move faster too.',
    '前沿 AI 模型正在把“漏洞出现到被利用”的时间窗口从数月压缩到数小时。采用这些工具的防守方能更快发现并修复漏洞；而采用这些工具的攻击者，或只是等待补丁后进行逆向分析的攻击者，也会同步提速。'
  ],
  [
    'This is not a future concern: models can already find serious vulnerabilities that traditional tooling and human reviewers have missed for years.',
    '这不是未来式风险，而是当下问题：模型已经能够发现一些传统工具和人工审查多年都没发现的严重漏洞。'
  ],
  [
    'This acceleration matters twice for any organization deploying agents. The infrastructure your agents run on is exposed to AI-accelerated offense like the rest of your estate, and the agents themselves introduce autonomy to interpret goals, select tools, and execute multi-step operations.',
    '对任何部署 AI 代理的组织来说，这种加速会带来双重影响：一方面，承载代理运行的基础设施和其他 IT 资产一样，会暴露在 AI 加速攻击面前；另一方面，代理自身具备解释目标、选择工具、执行多步操作的自主性。'
  ],
  [
    "Traditional access controls won't prevent agents from misusing legitimate permissions, and monitoring needs to account for attacks designed to succeed through persistence rather than exploitation.",
    '传统访问控制并不能阻止代理滥用“本来就被授予”的合法权限；监控体系也必须考虑那类依靠持续尝试、而不是依靠单点漏洞利用来达成目标的攻击。'
  ],
  [
    'Zero Trust—trust nothing, verify everything, and assume breach has already occurred—gives security leaders a proven foundation to address this.',
    'Zero Trust 的核心原则——不信任任何对象、验证一切请求，并默认系统已经发生入侵——为安全负责人提供了一套成熟、可落地的基础框架。'
  ],
  [
    'But the principles need new shape for agentic systems: identities that are cryptographically rooted, permissions scoped per task, memory protected against poisoning, and defensive operations that run at the speed of autonomous attackers.',
    '但在代理系统里，这些原则需要被重新塑形：身份必须有加密学根基，权限必须按任务粒度收缩，记忆必须防止被污染，而防御运营速度也必须足以跟上自治攻击者。'
  ],
  [
    'To help security and risk leaders build for this shift, we put together a practical framework for deploying autonomous AI agents in the enterprise.',
    '为帮助安全与风险负责人适应这一变化，Anthropic 给出了一套面向企业部署自治 AI 代理的实用框架。'
  ],
  [
    'In this guide, we share: the security considerations unique to agentic systems; the current threat landscape for agents; a three-tier Zero Trust framework (Foundation, Advanced, and Optimized); an eight-phase implementation workflow; how to run agentic security operations fast enough to contend with AI-accelerated attackers; and compliance alignment for regulated industries including healthcare, finance, and government.',
    '文章说明其配套指南将覆盖：代理系统独有的安全考量、当前代理威胁版图、三层级 Zero Trust 框架（Foundation / Advanced / Optimized）、八阶段实施流程、如何构建足够快的 Agentic SOAR，以及如何与医疗、金融、政府等强监管行业的合规要求对齐。'
  ],
  [
    'The organizations best positioned for this shift will be the ones whose fundamentals are strong enough that AI-assisted scanning finds fewer bugs in the first place, and whose agent deployments are architected for breach from day one.',
    '最能适应这一转变的组织，将是那些本身安全基本功足够扎实、以至于 AI 辅助扫描一开始就找不到太多漏洞，并且从第一天起就按“默认会被攻破”的思路来设计代理部署的组织。'
  ],
  [
    'Check it out, here: https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6a1611a04085d7cd3dadc924_Claude-eBook-Zero-Trust-for-AI-Agents-05182026.pdf.',
    '文末还给出了完整电子书链接，说明这篇博客更像是一篇框架性导读，目的是把读者引向更完整的 PDF 指南。'
  ],
  [
    'Partiality note: this KB entry is based on the accessible blog post body fetched from the public page, which is a short announcement/overview rather than the full linked eBook.',
    '完整性说明：这条 KB 基于公开博客页可访问正文写成；该页面本身是简短导读，并不是文中链接的完整电子书全文。'
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
    children: blocks
  })
});

console.log(JSON.stringify({ id: res.id, url: res.url }, null, 2));
