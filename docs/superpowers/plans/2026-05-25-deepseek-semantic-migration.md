# DeepSeek Semantic Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ai-pulse-scout` read and describe its key-insight provider as DeepSeek while remaining backward-compatible with existing `GLM_*` environment variables.

**Architecture:** The migration keeps the existing insight generation flow intact and only changes provider semantics at the edges: docs, tests, constant names, defaults, and user-facing runtime strings. Runtime env lookup becomes compatibility-based, preferring `DEEPSEEK_*` variables and falling back to `GLM_*`, so existing configs continue to work without immediate renaming.

**Tech Stack:** TypeScript, Vitest, dotenv-style env files, markdown documentation

---

## File structure

- Modify: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts` — switch defaults to DeepSeek, add `DEEPSEEK_*` → `GLM_*` fallback reads, and update runtime log/error wording.
- Modify: `ai-pulse-scout/tests/analyzeKeyInsights.test.ts` — update test names, provider values, and assertions to DeepSeek semantics, including env fallback coverage.
- Modify: `ai-pulse-scout/README.md` — replace GLM wording with DeepSeek wording.

### Task 1: Update runtime provider semantics with env compatibility

**Files:**
- Modify: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`
- Test: `ai-pulse-scout/tests/analyzeKeyInsights.test.ts`

- [ ] **Step 1: Write the failing compatibility test**

Add this test to `ai-pulse-scout/tests/analyzeKeyInsights.test.ts` inside the `describe('enrichKeyInsights', ...)` block:

```ts
  it('prefers DEEPSEEK env vars and falls back to GLM env vars', async () => {
    const originalEnv = { ...process.env };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'DeepSeek-compatible insight.',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    process.env.DEEPSEEK_API_KEY = 'deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';
    process.env.DEEPSEEK_MODEL = 'deepseek-v3.2';
    delete process.env.GLM_API_KEY;
    delete process.env.GLM_BASE_URL;
    delete process.env.GLM_MODEL;

    const [deepseekItem] = await enrichKeyInsights([makeItem()], {
      fetchFullPosts: false,
    });

    expect(deepseekItem.key_insight).toBe('DeepSeek-compatible insight.');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://aigw.aac.tech/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"deepseek-v3.2"'),
      }),
    );

    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    process.env.GLM_API_KEY = 'glm-fallback-key';
    process.env.GLM_BASE_URL = 'https://fallback.example/v1';
    process.env.GLM_MODEL = 'fallback-model';

    const [fallbackItem] = await enrichKeyInsights([makeItem()], {
      fetchFullPosts: false,
    });

    expect(fallbackItem.key_insight).toBe('DeepSeek-compatible insight.');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://fallback.example/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"fallback-model"'),
      }),
    );

    process.env = originalEnv;
  });
```

- [ ] **Step 2: Run the focused test to verify it fails before implementation**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/analyzeKeyInsights.test.ts
```

Expected result: FAIL because runtime does not yet read `DEEPSEEK_*` variables.

- [ ] **Step 3: Implement DeepSeek-first runtime semantics**

Update `ai-pulse-scout/src/insights/analyzeKeyInsights.ts` so the top constants and env reads become:

```ts
const DEFAULT_DEEPSEEK_BASE_URL = 'https://aigw.aac.tech/v1';
const DEFAULT_MODEL = 'deepseek-v3.2';
```

And inside `enrichKeyInsights(...)`:

```ts
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? process.env.GLM_API_KEY;
  if (!apiKey) {
    logger.info('DEEPSEEK_API_KEY not set (and GLM_API_KEY fallback missing) -- using feed excerpts as key insights.');
    return items;
  }

  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? process.env.GLM_MODEL ?? DEFAULT_MODEL;
  const baseUrl = options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? process.env.GLM_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL;
  const endpoint = options.endpoint ?? buildChatCompletionsEndpoint(baseUrl);
  const fetchFullPosts =
    options.fetchFullPosts ??
    (process.env.DEEPSEEK_FETCH_FULL_POSTS ?? process.env.GLM_FETCH_FULL_POSTS) !== 'false';
```

Also update the error string in `generateKeyInsight(...)` to:

```ts
    throw new Error(payload.error?.message ?? `DeepSeek request failed with HTTP ${response.status}`);
```

And update the warning line in the catch block to:

```ts
      logger.warn(`DeepSeek key insight analysis failed for "${item.title}": ${message}`);
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/analyzeKeyInsights.test.ts
```

Expected result: PASS.

- [ ] **Step 5: Commit the runtime compatibility change**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git add ai-pulse-scout/src/insights/analyzeKeyInsights.ts ai-pulse-scout/tests/analyzeKeyInsights.test.ts
git commit -m "feat: make key insights deepseek-first"
```

Expected result: one commit containing the runtime compatibility change and its tests.

### Task 2: Update the existing test wording and assertions to DeepSeek semantics

**Files:**
- Modify: `ai-pulse-scout/tests/analyzeKeyInsights.test.ts`

- [ ] **Step 1: Rename existing GLM-specific test descriptions and values**

Update these test fragments in `ai-pulse-scout/tests/analyzeKeyInsights.test.ts`:

```ts
  it('adds key insight from DeepSeek chat completion response', async () => {
```

```ts
      baseUrl: 'https://aigw.aac.tech/v1',
      model: 'deepseek-v3.2',
```

```ts
      'https://aigw.aac.tech/v1/chat/completions',
```

```ts
        body: expect.stringContaining('"model":"deepseek-v3.2"'),
```

```ts
  it('falls back to original item when DeepSeek request fails', async () => {
```

- [ ] **Step 2: Verify the updated provider wording in the focused tests**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npx vitest run tests/analyzeKeyInsights.test.ts
```

Expected result: PASS with the new DeepSeek wording and values.

- [ ] **Step 3: Commit the semantic test cleanup**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git add ai-pulse-scout/tests/analyzeKeyInsights.test.ts
git commit -m "test: rename glm insight tests to deepseek"
```

Expected result: one commit containing the semantic cleanup if it was not already folded into the previous commit.

### Task 3: Update README wording

**Files:**
- Modify: `ai-pulse-scout/README.md`

- [ ] **Step 1: Replace the top-level provider description**

Edit the opening paragraph in `ai-pulse-scout/README.md` to:

```md
A portable TypeScript project that automatically collects recent AI updates from a curated source list, deduplicates items, uses DeepSeek to generate concise key insights, renders an HTML executive digest, and sends it via SMTP.
```

- [ ] **Step 2: Verify no GLM wording remains in README**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
rg -n "GLM|glm|bigmodel" README.md
```

Expected result: no matches.

- [ ] **Step 3: Commit the README update**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git add ai-pulse-scout/README.md
git commit -m "docs: describe deepseek insight generation"
```

Expected result: one commit containing only the README wording change unless already grouped with nearby semantic updates.

### Task 4: Full verification

**Files:**
- Verify: `ai-pulse-scout/src/insights/analyzeKeyInsights.ts`
- Verify: `ai-pulse-scout/tests/analyzeKeyInsights.test.ts`
- Verify: `ai-pulse-scout/README.md`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
npm test
```

Expected result: full test suite passes.

- [ ] **Step 2: Verify the remaining provider strings**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp/ai-pulse-scout
rg -n "GLM|glm|bigmodel|DEEPSEEK|deepseek" src tests README.md
```

Expected result:
- README and tests should describe DeepSeek
- `src/insights/analyzeKeyInsights.ts` may still reference `GLM_*` only as env fallback names
- No lingering BigModel default URL should remain

- [ ] **Step 3: Check git status for intended files only**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git status --short
```

Expected result: only the intended code, test, and docs files are modified or committed.

- [ ] **Step 4: Commit the plan file if needed**

Run:

```bash
cd /Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-mvp
git add docs/superpowers/plans/2026-05-25-deepseek-semantic-migration.md
git commit -m "docs: add deepseek semantic migration plan"
```

Expected result: the implementation plan is versioned alongside the work.
