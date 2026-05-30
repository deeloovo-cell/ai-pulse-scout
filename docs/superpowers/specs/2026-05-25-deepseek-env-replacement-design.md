# DeepSeek env replacement design

## Goal

Replace the existing GLM environment-variable values used by `ai-pulse-scout` with the user's DeepSeek v3.2 configuration, without changing application code.

## Scope

In scope:
- Update `ai-pulse-scout/.env`
- Update `ai-pulse-scout/.env.example`

Out of scope:
- Renaming `GLM_*` environment variables
- Changing TypeScript source code
- Changing tests
- Changing README or other docs beyond this design note

## Current state

The project code reads these existing environment variables:
- `GLM_API_KEY`
- `GLM_BASE_URL`
- `GLM_MODEL`
- `GLM_FETCH_FULL_POSTS`

So the lowest-risk migration is to keep those names and only replace their values.

## Chosen approach

Keep the current `GLM_*` variable names, but point them at DeepSeek:
- `GLM_API_KEY` → user's AAC DeepSeek API key
- `GLM_BASE_URL` → `https://aigw.aac.tech/v1`
- `GLM_MODEL` → `deepseek-v3.2`
- `GLM_FETCH_FULL_POSTS` remains `true`

## Alternatives considered

### 1. Rename env vars to `DEEPSEEK_*`
Pros:
- Semantically cleaner

Cons:
- Requires code, tests, and docs changes
- Higher risk for a simple config migration

### 2. Support both `GLM_*` and `DEEPSEEK_*`
Pros:
- Easier future migration path

Cons:
- Requires code changes
- Adds unnecessary complexity for this request

## Why this is recommended

This is the smallest possible change that satisfies the request and preserves current runtime behavior.

## Expected outcome

After the edit, the project will continue using the same env variable names, but requests will go to the AAC DeepSeek-compatible endpoint with model `deepseek-v3.2` instead of GLM.
