# DeepSeek Env Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the existing `ai-pulse-scout` GLM environment configuration at the AAC DeepSeek v3.2 endpoint without changing application code.

**Architecture:** The project already reads `GLM_*` environment variables inside `src/insights/analyzeKeyInsights.ts`. To keep the change low-risk, only `.env` and `.env.example` will be updated so those existing variables now resolve to the DeepSeek-compatible endpoint and model. Runtime code, tests, and docs remain unchanged.

**Tech Stack:** TypeScript, Vitest, dotenv-style env files

---

## File structure

- Modify: `ai-pulse-scout/.env` — replace the current live GLM credentials/base URL/model values with the AAC DeepSeek v3.2 values.
- Modify: `ai-pulse-scout/.env.example` — replace the example GLM endpoint/model values with DeepSeek-compatible example values while preserving placeholder secrets.
- Verify against: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts` — confirms the code still reads `GLM_API_KEY`, `GLM_BASE_URL`, `GLM_MODEL`, and `GLM_FETCH_FULL_POSTS`.

### Task 1: Update live env file

**Files:**
- Modify: `ai-pulse-scout/.env`
- Verify against: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`

- [ ] **Step 1: Confirm the runtime env variable names used by the app**

Read this code in `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`:

```ts
const apiKey = options.apiKey ?? process.env.GLM_API_KEY;
const model = options.model ?? process.env.GLM_MODEL ?? DEFAULT_MODEL;
const baseUrl = options.baseUrl ?? process.env.GLM_BASE_URL ?? DEFAULT_GLM_BASE_URL;
const fetchFullPosts = options.fetchFullPosts ?? process.env.GLM_FETCH_FULL_POSTS !== 'false';
```

Expected result: the application still depends on the existing `GLM_*` variable names, so only values should change.

- [ ] **Step 2: Replace GLM values in the live env file**

Edit `ai-pulse-scout/.env` so the relevant block becomes:

```env
GLM_API_KEY=sk-B7uXkVGK1KC94oeuipYzIBMLCw3P0r5wEn5rlJc44YboCov9
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true
```

Do not rename the variables. Keep all SMTP settings unchanged.

- [ ] **Step 3: Verify the live env file contains the expected values**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
rg -n "^GLM_API_KEY=|^GLM_BASE_URL=|^GLM_MODEL=|^GLM_FETCH_FULL_POSTS=" .env
```

Expected output:

```text
GLM_API_KEY=sk-B7uXkVGK1KC94oeuipYzIBMLCw3P0r5wEn5rlJc44YboCov9
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true
```

- [ ] **Step 4: Commit the live env change**

Run:

```bash
git add ai-pulse-scout/.env
git commit -m "chore: point glm env to deepseek"
```

Expected result: one commit containing only the `.env` update.

### Task 2: Update example env file

**Files:**
- Modify: `ai-pulse-scout/.env.example`
- Verify against: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`

- [ ] **Step 1: Keep example variable names stable**

The example file must continue to expose the same keys used by the runtime:

```env
GLM_API_KEY=
GLM_BASE_URL=
GLM_MODEL=
GLM_FETCH_FULL_POSTS=
```

Expected result: developers can still copy the example file without changing application code.

- [ ] **Step 2: Replace only the example endpoint/model values**

Edit `ai-pulse-scout/.env.example` so the relevant block becomes:

```env
# GLM key insight analysis
GLM_API_KEY=
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true
```

Keep `GLM_API_KEY` blank in the example file.

- [ ] **Step 3: Verify the example env file contains the expected values**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
rg -n "^GLM_API_KEY=|^GLM_BASE_URL=|^GLM_MODEL=|^GLM_FETCH_FULL_POSTS=" .env.example
```

Expected output:

```text
GLM_API_KEY=
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true
```

- [ ] **Step 4: Commit the example env change**

Run:

```bash
git add ai-pulse-scout/.env.example
git commit -m "docs: update example env for deepseek"
```

Expected result: one commit containing only the `.env.example` update.

### Task 3: Final verification

**Files:**
- Verify: `ai-pulse-scout/.env`
- Verify: `ai-pulse-scout/.env.example`
- Verify against: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`

- [ ] **Step 1: Verify code still maps env values into the request**

Read this code path in `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`:

```ts
const model = options.model ?? process.env.GLM_MODEL ?? DEFAULT_MODEL;
const baseUrl = options.baseUrl ?? process.env.GLM_BASE_URL ?? DEFAULT_GLM_BASE_URL;
const endpoint = options.endpoint ?? buildChatCompletionsEndpoint(baseUrl);
```

And this helper:

```ts
function buildChatCompletionsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}
```

Expected result: with `GLM_BASE_URL=https://aigw.aac.tech/v1`, requests will resolve to `https://aigw.aac.tech/v1/chat/completions`.

- [ ] **Step 2: Run a focused grep verification for both env files**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
printf "== .env ==\n" && rg -n "^GLM_API_KEY=|^GLM_BASE_URL=|^GLM_MODEL=|^GLM_FETCH_FULL_POSTS=" .env
printf "\n== .env.example ==\n" && rg -n "^GLM_API_KEY=|^GLM_BASE_URL=|^GLM_MODEL=|^GLM_FETCH_FULL_POSTS=" .env.example
```

Expected output:

```text
== .env ==
GLM_API_KEY=sk-B7uXkVGK1KC94oeuipYzIBMLCw3P0r5wEn5rlJc44YboCov9
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true

== .env.example ==
GLM_API_KEY=
GLM_BASE_URL=https://aigw.aac.tech/v1
GLM_MODEL=deepseek-v3.2
GLM_FETCH_FULL_POSTS=true
```

- [ ] **Step 3: Check git status to confirm only intended files changed**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git status --short
```

Expected output should show the plan file plus the env file changes and no unrelated source edits.

- [ ] **Step 4: Commit the final plan file if it is not already committed**

Run:

```bash
git add docs/superpowers/plans/2026-05-25-deepseek-env-replacement.md
git commit -m "docs: add deepseek env replacement plan"
```

Expected result: the implementation plan is versioned alongside the config change history.
