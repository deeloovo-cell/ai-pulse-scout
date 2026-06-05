# AI Pulse Scout Design: Two-Part Summary + Relevance Expansion

Date: 2026-06-05
Repo: `ai-pulse-scout`
Status: Approved for spec writing, pending final user review before implementation planning

## Goal

Adjust AI Pulse Scout's digest summary generation so each item produces a fixed two-part Chinese summary without changing page structure or UI.

The new summary should separate:
1. **Original-content AI summary** — what the source actually says
2. **Relevance expansion** — why it matters for the user's interests, especially high-tech manufacturing business functions

This change is limited to the summary / relevance generation layer. It must not modify the page layout, card structure, or add new UI elements.

## Hard Constraints

- Do **not** change static-site page structure
- Do **not** add new visual components or metadata chips for business domains
- Do **not** change card layout or interaction patterns
- Only adjust summary generation inputs, normalization, and output text structure
- Do not force relevance expansion when relevance is weak
- Do not treat biotech / health AI or climate tech as user-interest directions for the second paragraph

## Confirmed Output Format

Each digest item should produce exactly two summary paragraphs.

### Paragraph 1: Original-content AI summary

Purpose:
- Faithfully summarize the source itself
- Answer "what is this item about?"
- Avoid injecting user-interest framing

Requirements:
- Grounded in the source content
- Prefer concrete topic / method / result / release / implication details
- Length can vary with source substance
- If the source is thin or partial, keep this paragraph short rather than padding it
- Must not repeat paragraph 2 wording

### Paragraph 2: Relevance expansion

Purpose:
- Explain why the item matters for the user's tracking interests
- Translate source content into a relevance judgment for the user's domains

Requirements:
- Written as natural language, not a field dump
- Explicitly names matched business domains when relevance is present
- Usually names **1–3** business domains max
- If relevance is weak, explicitly say relevance is limited rather than forcing a mapping
- Must not repeat paragraph 1 content in paraphrased form

## Relevance Sources

Paragraph 2 should be generated from a normalized internal relevance view built from these inputs:

1. Existing topic classification
   - `primary_topic`
2. Existing topic badges / topic cues
   - keep these interest directions available:
     - 智能体
     - 多模态
     - 大模型
     - 计算机视觉
     - 机器人
     - AI 基础设施
   - explicitly exclude as user-interest drivers:
     - 生物医药 / 医药科技
     - 气候科技
3. Existing insight metadata
   - `applies_to`
   - `action`
   - `manufacturing_relevance`
4. Newly added manufacturing business-domain relevance detection
   - 销售
   - 研发
   - 生产
   - 质量
   - 人事
   - 财务
   - 供应链
   - 计划

## Normalized Internal Model

Before generating paragraph 2, the pipeline should build a normalized relevance object for each item.

Suggested shape:

```ts
interface NormalizedRelevance {
  matchedTopics: string[];
  matchedBusinessDomains: Array<{
    label: '销售' | '研发' | '生产' | '质量' | '人事' | '财务' | '供应链' | '计划';
    strength: 'high' | 'medium' | 'low';
    evidence: 'content' | 'metadata' | 'inferred';
  }>;
  manufacturingRelevance?: 'high' | 'medium' | 'low';
  recommendedAction?: string;
  overallStrength: 'high' | 'medium' | 'low';
}
```

Exact field names may change during implementation, but the design requires these concepts:
- topic / theme matches
- business-domain matches
- match strength
- evidence source
- a final overall relevance strength used by paragraph 2 generation

## Mapping and Deduplication Rules

Internal sources may mix old and new labels, but final output must not duplicate meaning.

Examples:
- `R&D` and `研发` are the same business domain
- repeated signals from topic + metadata + heuristic rules should collapse into one final domain mention
- output should not list synonymous terms separately

Rules:
- Normalize old field values into one canonical Chinese label set before text generation
- If multiple sources hit the same business domain, keep the strongest match and best evidence
- Prefer direct content evidence over older metadata when they conflict
- If conflict remains unresolved, output fewer domains rather than exposing contradictory labels

## Paragraph 2 Writing Policy

### High relevance

Use when source content directly connects to user-interest themes or business domains.

Output behavior:
- Explain the concrete relevance
- Optionally extend one step beyond the source if the inference is stable
- Name the matched business domains explicitly

Target style:
- “更值得关注的是它对研发流程自动化和供应链协同的潜在影响……相关业务域：研发、供应链。”

### Medium relevance

Use when the source does not directly discuss the business domain, but a stable mapping is still justified.

Output behavior:
- Provide one conservative relevance angle
- Avoid broad strategic extrapolation
- Name 1–2 business domains at most

### Low relevance

Use when the source has weak or indirect value for the tracked domains.

Output behavior:
- Explicitly say relevance is limited
- Optionally note that the item is still useful as background / frontier / capability signal
- Do not force business-domain coverage

Target style:
- “这条更适合作为前沿技术信号跟踪，与当前关注业务域的直接相关性有限。”

## What Paragraph 2 Must Avoid

- Do not map every item to all business domains
- Do not output generic filler like “对企业数字化转型有重要意义” without specifics
- Do not repeat paragraph 1 content with slightly different wording
- Do not expand into biotech / climate relevance as if those were user-interest targets
- Do not output a raw list of labels in place of explanation

## Boundary Cases

### Thin or partial source content

If the source is weak, partial, or low-information:
- keep paragraph 1 short and honest
- paragraph 2 should only use stable relevance
- if stable relevance is absent, say relevance is limited

### Highly technical but weak business mapping

Examples:
- compression
- quantization
- benchmark reports
- low-level infra papers

Handling:
- paragraph 1 summarizes the technical core normally
- paragraph 2 may stop at a narrow mapping such as 研发 / 基础能力储备
- do not force weak mappings to sales, finance, HR, etc.

### Conflicting legacy metadata

If old fields imply one domain and content evidence implies another:
- prefer source-grounded content evidence
- use metadata as a supporting signal, not final truth
- cap final named domains to the strongest 1–3

### No meaningful relevance

This is valid output, not failure.

Paragraph 2 may say relevance is limited and stop there.

## Scope of Change

### In scope
- summary generation logic
- relevance normalization logic
- prompt / formatting changes needed to generate the two-part summary
- tests covering structure, deduplication, and weak-relevance restraint

### Out of scope
- static page layout changes
- card structure updates
- new chips / badges / fields rendered in UI
- changing review-page or static-page layout to separately display business domains
- broader ranking changes unrelated to summary generation

## Acceptance Criteria

The feature is acceptable when all of the following are true.

### Structure
- every generated digest summary is two paragraphs
- paragraph 1 is source-summary oriented
- paragraph 2 is relevance-expansion oriented

### Content quality
- paragraph 1 does not inject user-interest framing unnecessarily
- paragraph 2 does not merely restate paragraph 1
- paragraph 2 explicitly names business domains when relevance is present
- paragraph 2 can explicitly say relevance is limited when appropriate

### Restraint and deduplication
- paragraph 2 names no more than 3 business domains
- synonymous sources are merged (for example `R&D` → `研发`)
- no biotech / climate expansion as user-interest output
- no “everything is relevant” style outputs

### Regression scenarios
At minimum, implementation validation should cover:
1. clearly manufacturing-relevant item
2. moderately relevant platform / agent item
3. low-level technical item with only weak business mapping
4. weakly relevant item where paragraph 2 must explicitly restrain itself

## Recommended Implementation Direction

Use a **normalized relevance layer first, then generate the two-part summary**.

Reasoning:
- stronger control over deduplication
- easier restraint when relevance is weak
- easier mapping from legacy metadata to the new Chinese business-domain vocabulary
- cleaner tests than a single all-in-one prompt-only approach

This should be implemented without changing page structure.

## Open Implementation Notes

These are not unresolved requirements; they are implementation choices left to planning:
- exact file boundaries for relevance normalization
- whether paragraph generation is fully prompt-based or partly template-assisted
- where business-domain inference rules live
- whether existing summary fields are replaced or a new intermediate field is introduced before rendering

The design requirement is stable regardless of these lower-level choices.
