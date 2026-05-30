# Remove GLM Fallback Design

## Goal
Remove GLM model usage from AI Pulse Scout so the project only attempts DeepSeek-backed enrichment when configured, and otherwise falls back to deterministic non-LLM behavior.

## Scope
- Remove GLM runtime fallback from LLM client resolution.
- Remove GLM-specific environment variable checks and user-facing log text.
- Remove or update tests that mention GLM fallback behavior.
- Clean obvious GLM references from project code paths involved in digest/enrichment.

## Non-Goals
- Changing DeepSeek behavior.
- Replacing DeepSeek with another provider.
- Broad docs cleanup unrelated to active digest/enrichment code paths.

## Approach
1. Find the LLM client resolution path and request helpers.
2. Delete GLM branches so client resolution is DeepSeek-only.
3. Update fallback logs to mention only missing DeepSeek configuration.
4. Update tests to reflect DeepSeek-only behavior.
5. Run targeted regressions for enrichment and digest flows.

## Risks
- Hidden GLM references outside the active digest path may remain if they are unrelated to current runtime.
- Tests asserting old fallback wording will fail until updated.

## Success Criteria
- No active digest/enrichment runtime path attempts GLM.
- Logs no longer mention `GLM_API_KEY` as a fallback.
- Relevant tests pass.
