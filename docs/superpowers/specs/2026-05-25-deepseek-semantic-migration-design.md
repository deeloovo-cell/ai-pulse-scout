# DeepSeek semantic migration design

## Goal

Update `ai-pulse-scout` so its docs, tests, and runtime wording reflect DeepSeek instead of GLM, while preserving backward compatibility with the existing `GLM_*` environment variables.

## Scope

In scope:
- Update README wording from GLM to DeepSeek
- Update tests so their names, fixtures, and expectations use DeepSeek defaults
- Update runtime code constants, log messages, and error messages to use DeepSeek terminology
- Add env-variable compatibility so runtime can read `DEEPSEEK_*` first and fall back to `GLM_*`

Out of scope:
- Removing `GLM_*` compatibility
- Changing business logic for digest generation
- Changing email rendering behavior
- Forcing existing deployed `.env` files to rename variables immediately

## Current state

The project currently:
- Documents key-insight generation as GLM-based in `README.md`
- Uses GLM-specific constant names and user-facing log/error text in `src/insights/analyzeKeyInsights.ts`
- Has tests asserting GLM base URL, GLM model, and GLM-specific descriptions
- Reads only `GLM_API_KEY`, `GLM_MODEL`, `GLM_BASE_URL`, and `GLM_FETCH_FULL_POSTS`

## Chosen approach

Use a compatibility migration:

1. **Runtime semantics become DeepSeek-first**
   - Default base URL becomes `https://aigw.aac.tech/v1`
   - Default model becomes `deepseek-v3.2`
   - Constant names and log/error strings refer to DeepSeek

2. **Environment variable compatibility stays intact**
   - Runtime reads:
     - `DEEPSEEK_API_KEY` first, then `GLM_API_KEY`
     - `DEEPSEEK_MODEL` first, then `GLM_MODEL`
     - `DEEPSEEK_BASE_URL` first, then `GLM_BASE_URL`
     - `DEEPSEEK_FETCH_FULL_POSTS` first, then `GLM_FETCH_FULL_POSTS`
   - This preserves old configurations while allowing new DeepSeek-native naming

3. **Tests and docs align with the new semantics**
   - README describes DeepSeek, not GLM
   - Tests describe DeepSeek responses and assert DeepSeek defaults

## Alternatives considered

### 1. README-only cleanup
Pros:
- Lowest effort

Cons:
- Leaves runtime and tests semantically inconsistent

### 2. Full `DEEPSEEK_*` breaking rename
Pros:
- Cleanest final naming

Cons:
- Breaks existing local and deployed configuration
- Requires immediate env migration everywhere

## Why this is recommended

This gives the project coherent DeepSeek semantics without breaking current setups. It also creates a gentle migration path from `GLM_*` to `DEEPSEEK_*` instead of forcing all users to rename secrets immediately.

## Expected outcome

After implementation:
- Project docs and tests will clearly describe DeepSeek
- Runtime logs and defaults will reflect DeepSeek
- Existing `GLM_*` env files will continue to work
- New `DEEPSEEK_*` env names will also work and take precedence when present
