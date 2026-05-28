# AI Pulse Scout email template adjustments design

Date: 2026-05-28
Project: `ai-pulse-scout`

## Goal

Adjust the daily email so it returns to the `AI Pulse Scout` brand while keeping the newer executive-brief structure, but shifting that structure away from company-growth framing and toward CIO/CAIO-relevant technical productivity and implementation focus.

## Approved direction

The user approved the following changes:

1. Change the email title back to `AI Pulse Scout`.
2. Remove the subtitle `CIO / Chief AI Officer brief — high-tech manufacturing`.
3. Keep the brief audience as CIO/CAIO, but refocus the content toward technical productivity, efficiency, technical execution, and adoption/implementation realism instead of company growth.
4. Remove the fixed 12-item cap for executive-brief generation; the brief should consider all digest items selected from the last 24 hours window.
5. Keep the email body aligned with the same selected item set rather than introducing a separate cap.

## Scope

This design changes only email-facing wording and executive-brief generation behavior. It does not redesign the item selection pipeline, source ingestion pipeline, or topic taxonomy.

In scope:
- sender/display title wording
- subject wording
- email header/subtitle rendering
- executive brief labels
- executive brief prompt wording
- executive brief context construction
- fallback brief wording

Out of scope:
- changing source selection rules
- changing digest ranking heuristics
- changing topic grouping
- changing transport / SMTP behavior

## Approach options considered

### Option A — full alignment across title, brief semantics, and item coverage
Update branding, remove the subtitle, rename the brief fields, refocus the prompt on productivity/implementation, and remove the 12-item cap so the brief sees all selected items.

Pros:
- matches the user request directly
- keeps email header, executive brief, and body semantically aligned
- avoids a mismatch where the top brief is generated from only a subset of items

Cons:
- increases prompt size for larger daily runs
- may need a soft character-budget fallback later if item counts grow significantly

### Option B — wording changes only, keep the 12-item cap
Update the language but keep the current executive-brief context truncation.

Pros:
- smaller implementation
- lower token usage

Cons:
- does not satisfy the user’s explicit request about the 12-item limit
- leaves brief/body mismatch risk in place

### Option C — branding rollback only
Restore `AI Pulse Scout` and remove the subtitle, with no executive-brief logic changes.

Pros:
- smallest change

Cons:
- misses the main content-direction request

## Recommendation

Implement Option A.

## Detailed design

### 1. Email branding and header

Update the email identity back to `AI Pulse Scout` while preserving the useful item-count subject format introduced in the latest change.

Changes:
- `config/email.yaml`
  - `from_name` becomes `AI Pulse Scout`
  - `subject_template` becomes `AI Pulse Scout — {date} | {count} signals`
- `src/render/renderHtmlEmail.ts`
  - header `h1` becomes `AI Pulse Scout`
  - remove the subtitle line entirely
  - keep the date / count / `Last 24 hours` line

Reasoning:
The user wants the old brand restored, but the `{count}` token is still useful and should remain unless later requested otherwise.

### 2. Executive brief field labels

Rename the top brief fields from growth-oriented language to implementation-oriented language.

Current labels:
- Opportunity
- Risk / watch
- R&D signal
- Suggested action

New labels:
- Productivity upside
- Adoption / implementation risk
- Technical signal
- Suggested action

Reasoning:
These labels stay executive-readable while shifting attention toward productivity impact and the practical difficulty of deploying or absorbing a technical change.

### 3. Executive brief prompt rewrite

Update `src/insights/generateExecutiveBrief.ts` so the prompt no longer emphasizes manufacturing growth enablement. The prompt should instead request a brief for a CIO/CAIO that emphasizes:
- productivity improvement potential
- efficiency or workflow leverage
- technical implementation friction
- practical next actions
- concrete technical or R&D signal
- no hype, no business-growth puffery

Expected JSON keys should match the new field semantics. The `ExecutiveBrief` data model should be updated accordingly so the renderer and parser remain consistent.

### 4. Executive brief context coverage

Current behavior truncates context with `items.slice(0, 12)`.

New behavior:
- use all `selected` digest items when building executive-brief context
- preserve the existing 24-hour collection window as the real boundary
- do not introduce a second fixed item cap in the executive-brief layer

Reasoning:
The digest selection phase already constrains relevance. A second arbitrary cap at the brief layer loses information and can cause the executive brief to summarize only part of the digest.

### 5. Soft guardrail for prompt size

No fixed numeric cap will remain, but the implementation may include a soft character-budget safeguard if needed to avoid pathological prompt sizes.

Preferred behavior if a safeguard is required:
- include all selected items by default
- only trim when the assembled prompt exceeds a conservative character threshold
- trim by accumulated context length, not by a hard-coded `12`
- keep the output messaging neutral; no user-facing claim that the system always saw everything if a soft truncation had to happen internally

This safeguard is optional for the first pass if the current item counts remain comfortably small.

### 6. Fallback executive brief wording

Fallback brief text should also shift from manufacturing/product-impact language to technical productivity language.

Examples of directional wording:
- productivity upside: review a lead item for automation or efficiency potential
- adoption / implementation risk: validate data quality, system fit, and rollout cost before pilot
- technical signal: surface the strongest technical insight from the lead item
- suggested action: assign a short technical review to the responsible platform / AI / engineering lead

### 7. Email body consistency

The email body should continue to render the selected digest items as-is. No separate body cap should be introduced as part of this change.

Interpretation:
- collection window = last 24 hours
- selection pipeline decides digest membership
- email body renders all selected items
- executive brief summarizes the same selected set

## Data and interface changes

### Executive brief type

The `ExecutiveBrief` interface will be renamed field-by-field to reflect the new semantics, or the parser/renderer will map old internal keys to new display labels.

Preferred implementation:
- rename the interface fields to match the new semantics for clarity end-to-end

Target shape:
```ts
interface ExecutiveBrief {
  productivity_upside: string;
  adoption_implementation_risk: string;
  technical_signal: string;
  suggested_action: string;
}
```

Reasoning:
Keeping the data model aligned with the rendered labels reduces confusion and makes future prompt work easier.

## Error handling

- If LLM generation fails, keep returning a fallback brief instead of blocking email rendering.
- If no items are selected, return `null` executive brief and continue using the empty-state email body.
- If optional soft prompt-size trimming is needed, do it silently and deterministically.

## Testing impact

Update or add tests to cover:
- subject rendering with restored `AI Pulse Scout` title and `{count}` replacement
- email header rendering without subtitle
- executive brief rendering with the new field labels
- executive brief parser compatibility with the new JSON keys
- executive brief context building without the fixed 12-item cap
- fallback brief using productivity/implementation wording

## Implementation notes

Likely touched files:
- `ai-pulse-scout/config/email.yaml`
- `ai-pulse-scout/src/render/renderHtmlEmail.ts`
- `ai-pulse-scout/src/insights/generateExecutiveBrief.ts`
- `ai-pulse-scout/src/insights/parseExecutiveInsight.ts`
- `ai-pulse-scout/src/types/executive.ts`
- relevant tests under `ai-pulse-scout/tests/`

## Success criteria

A successful implementation will result in:
- the email visually branded again as `AI Pulse Scout`
- no subtitle line under the header
- executive brief labels centered on productivity and implementation
- executive brief prompt behavior aligned to technical/execution framing rather than growth framing
- no fixed 12-item cap in brief generation
- email body and executive brief based on the same selected item set
