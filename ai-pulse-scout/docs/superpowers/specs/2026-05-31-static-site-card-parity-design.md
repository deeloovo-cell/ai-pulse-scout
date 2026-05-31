# AI Pulse Scout Static Site Card Parity Design

Date: 2026-05-31
Branch: `feature/ai-pulse-scout-mvp`

## Goal

Bring the static-site card UI and card-body content closer to the user-provided `ai_pulse_scout_v4.html` mockup without changing the deployment/publish architecture.

This pass is not only a visual cleanup. It also restores a previously expected requirement: card summaries on the static site should prefer LLM-enrichment-style content instead of defaulting to raw or lightly truncated feed snippets.

## User-Confirmed Requirements

### Visual structure
Each static-site card should include:
- top-left match percentage pill
- top-right topic badges
- title
- Chinese card summary in an enrichment-like style
- bottom metadata row containing `Relevant rank` and `Follow-up`

### Tag rules
- Show only topic badges
- Do **not** show source-origin labels such as `arXiv`, `cs.AI`, or `cs.LG`
- Topic badges should be rendered in Chinese
- Keep badge count low and readable, typically 1-2 badges per card

### Summary rules
- The absence of LLM enrichment on the current page is treated as a missed requirement, not a stretch goal
- Summary text should prioritize clarity over extreme brevity
- The desired style is conclusion-first, then supporting explanation
- Summary fallback priority:
  1. LLM enrichment
  2. normal summary
  3. raw snippet fallback

### Match / relevance / follow-up rules
- `match %` should be display-oriented and stable, not presented as a scientifically exact score unless one already exists upstream
- `Relevant rank` and `Follow-up` should be rendered as visual-only display elements in this phase
- No persistence, no saved per-user interaction state, and no backend write path in this pass

### Visual treatment
- Follow the overall structure and color feel of the provided mockup closely
- Replace the current plain white-card presentation with a denser feed-card style closer to the mockup

## Recommended Approach

Use a renderer-first implementation.

Preferred strategy:
1. Update the static-site renderer to output the richer card structure
2. Reuse existing enrichment-oriented fields whenever they already exist in the pipeline
3. Add only minimal data-shaping logic if the renderer cannot currently access the needed values
4. Avoid changing deployment, scheduling, or unrelated pipeline components

This keeps the work focused on the actual gap: the generated static page is missing required presentation and enrichment rendering, not suffering from deployment architecture problems.

## Data Mapping Rules

### Topic badges
Badge generation should prefer already available semantic information and only fall back to lightweight heuristics when necessary.

Priority order:
1. explicit enrichment/topic metadata if present
2. existing normalized metadata fields
3. lightweight inference from title/summary/content context

Guidance:
- return a small set of Chinese topic labels
- avoid internal source taxonomy labels
- optimize for readability rather than taxonomy completeness

Examples of acceptable badge families:
- 大模型
- 智能体
- 多模态
- 机器人
- 计算机视觉
- 语音
- 搜索推荐
- 生物医药
- 气候科技
- AI 基础设施

### Match percentage
The match indicator should be a user-facing priority cue.

Rules:
- if an existing upstream priority/relevance signal can be reused directly, map it into a percentage display
- otherwise derive a stable display percentage from relative ordering within the selected daily result set
- use tiered color styling consistent with the mockup:
  - high: green range
  - medium: yellow range
  - low: red range

### Summary body
Card summaries should be rendered in Chinese and prefer richer, clearer wording over raw truncation.

Rules:
- prefer existing LLM-enrichment output when available
- if enrichment exists and is already clear, do not over-compress it into a single short sentence
- if enrichment is absent, use the best available summary field
- only fall back to raw content snippets when structured summary content is unavailable

Target shape:
- sentence 1: core takeaway / why this matters
- sentence 2-3: method, result, implication, or application detail

## Scope Boundaries

### In scope
- static-site card structure
- static-site card styling
- static-site summary selection logic for page rendering
- minimal field adaptation if needed to expose already-available enrichment data to the renderer
- focused static-site tests covering the new renderer behavior

### Out of scope
- deploy hook logic
- scheduler/autopublish logic
- Vercel settings
- send-daily email flow
- review server redesign
- persistent rating/follow-up state
- new recommendation or scoring services

## Likely Files

Primary targets:
- `src/static/renderStaticSite.ts`
- related static-site renderer tests

Possible minimal-support targets if required:
- `src/static/exportStaticSite.ts`
- `src/adapters/feedAdapter.ts`
- `src/types/item.ts`

Constraint:
Only widen beyond the renderer if required to surface fields that already exist conceptually in the pipeline.

## Acceptance Criteria

### Structural acceptance
Generated static cards should visibly include:
- match % pill
- Chinese topic badges
- title
- enrichment-style Chinese summary
- `Relevant rank`
- `Follow-up`

### Negative acceptance
Generated pages should not show:
- source-origin labels like `arXiv`, `cs.AI`, `cs.LG`
- the old minimal title/summary/url-only card layout

### Content acceptance
- summary rendering should prefer enrichment content over raw snippet text
- summaries should read like processed insight text, not just clipped source text
- summary length may be slightly longer than the current page if needed for clarity

### Engineering acceptance
- `npm run build:site` remains functional
- `npm run site:export -- --date YYYY-MM-DD` remains functional
- the existing publish/deploy chain is not changed by this pass

### Verification expectations
Verification should include:
- relevant static-site tests
- a fresh static export/build
- inspection of generated `index.html` and day-page output to confirm required structure/content are present

## Risks and Mitigations

### Risk: renderer reaches for fields that are not consistently present
Mitigation:
- keep fallback chain explicit
- add only minimal shaping logic where needed

### Risk: topic badge inference becomes noisy or too taxonomy-heavy
Mitigation:
- cap badge count at 1-2
- prefer broad readable Chinese labels over raw source categories

### Risk: summary becomes too short or too raw again
Mitigation:
- make fallback priority explicit in renderer logic
- verify output against generated HTML, not only unit tests
