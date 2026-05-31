# Daily Static Site Auto-Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 07:00 local scheduler build the latest static site and trigger Vercel deployment automatically so `daily.deanlu.ai` refreshes each morning without manual action.

**Architecture:** Add a dedicated publish CLI that reuses `build:site` and triggers a Vercel deploy hook, wrap it with a launchd-friendly shell script, and repoint the existing 07:00 launchd job to that wrapper. Keep the current manual export and build entrypoints intact while making the scheduled path observable through logs and explicit env validation.

**Tech Stack:** TypeScript, Node.js, tsx, macOS launchd, shell scripts, Vercel deploy hook, Vitest

---

### Task 1: Add publish CLI tests first

**Files:**
- Create: `tests/cli/publishStaticSite.test.ts`
- Test: `tests/cli/publishStaticSite.test.ts`

- [ ] **Step 1: Write the failing test for missing deploy hook env**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const spawnMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

describe('publishStaticSite CLI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.VERCEL_DEPLOY_HOOK_URL;
  });

  it('fails fast when VERCEL_DEPLOY_HOOK_URL is missing', async () => {
    await expect(import('../../src/cli/publishStaticSite.js')).rejects.toThrow(
      /VERCEL_DEPLOY_HOOK_URL/,
    );
    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the failing test for successful build then deploy-hook trigger**

```ts
import { EventEmitter } from 'node:events';

it('runs build:site and then triggers the Vercel deploy hook', async () => {
  process.env.VERCEL_DEPLOY_HOOK_URL = 'https://example.com/deploy-hook';
  const child = new EventEmitter() as EventEmitter & { on: typeof EventEmitter.prototype.on };
  spawnMock.mockReturnValue(child);
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
  vi.stubGlobal('fetch', fetchMock);

  const importPromise = import('../../src/cli/publishStaticSite.js');
  queueMicrotask(() => child.emit('exit', 0, null));
  await importPromise;

  expect(spawnMock).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith('https://example.com/deploy-hook', expect.objectContaining({
    method: 'POST',
  }));
});
```

- [ ] **Step 3: Run the focused tests to verify failure**

Run: `npx vitest run tests/cli/publishStaticSite.test.ts`
Expected: FAIL because `src/cli/publishStaticSite.ts` does not exist yet.

- [ ] **Step 4: Commit the red test**

```bash
git add tests/cli/publishStaticSite.test.ts
git commit -m "test: add static site autopublish cli coverage"
```

### Task 2: Implement the publish CLI

**Files:**
- Create: `src/cli/publishStaticSite.ts`
- Modify: `package.json`
- Test: `tests/cli/publishStaticSite.test.ts`

- [ ] **Step 1: Create the publish CLI with explicit env validation and build delegation**

```ts
import 'dotenv/config';
import { spawn } from 'node:child_process';

function runBuildSite(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli/buildStaticSite.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`build:site terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`build:site exited with code ${code ?? 'unknown'}`));
        return;
      }
      resolve();
    });
  });
}

async function triggerDeployHook(url: string): Promise<void> {
  const response = await fetch(url, { method: 'POST' });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Deploy hook failed with status ${response.status}: ${body}`);
  }
  console.log(`Deploy hook accepted (${response.status}): ${body}`);
}

const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
if (!deployHookUrl) {
  throw new Error('VERCEL_DEPLOY_HOOK_URL is required for static-site autopublish');
}

console.log('=== AI Pulse Scout — Static Site Autopublish ===');
console.log('Step 1/2: build static site');
await runBuildSite();
console.log('Step 2/2: trigger Vercel deploy hook');
await triggerDeployHook(deployHookUrl);
console.log('=== Done (OK) ===');
```

- [ ] **Step 2: Add an npm script for the new CLI**

```json
{
  "scripts": {
    "publish:site": "tsx src/cli/publishStaticSite.ts"
  }
}
```

- [ ] **Step 3: Run the focused tests to verify they pass**

Run: `npx vitest run tests/cli/publishStaticSite.test.ts`
Expected: PASS with 1 test file passed.

- [ ] **Step 4: Commit the CLI implementation**

```bash
git add src/cli/publishStaticSite.ts package.json tests/cli/publishStaticSite.test.ts
git commit -m "feat: add static site autopublish cli"
```

### Task 3: Rewire the launchd wrapper to the site publish path

**Files:**
- Create: `scripts/publish-static-site.sh`
- Modify: `scripts/com.ai-pulse-scout.daily.plist`
- Modify: `scripts/install-schedule.sh`

- [ ] **Step 1: Add a launchd-friendly shell wrapper for the publish CLI**

```bash
#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/data/logs"
LOG_FILE="$LOG_DIR/static-site-publish-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== Daily static-site publish starting ==="
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR"

if ! command -v node &>/dev/null; then
  log "ERROR: node not found in PATH."
  exit 1
fi

log "node $(node --version)"
log "project $PROJECT_DIR"
./node_modules/.bin/tsx src/cli/publishStaticSite.ts
log "=== Done (OK) ==="
```

- [ ] **Step 2: Repoint the launchd plist to the new wrapper**

```xml
<key>ProgramArguments</key>
<array>
    <string>/bin/bash</string>
    <string>__PROJECT_DIR__/scripts/publish-static-site.sh</string>
</array>
```

- [ ] **Step 3: Update install output so operators know which log file to inspect**

```bash
echo "  Logs   : tail -f $PROJECT_DIR/data/logs/static-site-publish-\$(date +%Y-%m-%d).log"
```

- [ ] **Step 4: Commit the scheduler rewiring**

```bash
git add scripts/publish-static-site.sh scripts/com.ai-pulse-scout.daily.plist scripts/install-schedule.sh
git commit -m "feat: schedule daily static site autopublish"
```

### Task 4: Document env + automation usage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README notes for automated morning site publishing**

```md
### Automated morning site publish

The 07:00 local launchd job can be used to automatically publish the static site each morning.

Required environment:

```bash
VERCEL_DEPLOY_HOOK_URL=https://vercel.com/api/hooks/...
```

Manual verification:

```bash
npm run publish:site
npm run schedule:install
npm run schedule:status
```
```

- [ ] **Step 2: Commit the documentation update**

```bash
git add README.md
git commit -m "docs: document daily static site autopublish"
```

### Task 5: Verify the end-to-end path locally

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused autopublish tests**

Run: `npx vitest run tests/cli/publishStaticSite.test.ts`
Expected: PASS

- [ ] **Step 2: Run the new production-path command manually**

Run: `VERCEL_DEPLOY_HOOK_URL='https://example.com/deploy-hook' npm run publish:site`
Expected: local build starts, deploy hook POST executes, command exits 0 when the hook is reachable.

- [ ] **Step 3: Reload the scheduler**

Run: `npm run schedule:install && npm run schedule:status`
Expected: `com.ai-pulse-scout.daily` appears as loaded instead of `Not loaded`.

- [ ] **Step 4: Inspect the expected log file path**

Run: `ls -l data/logs/static-site-publish-$(date +%Y-%m-%d).log`
Expected: the daily static publish log exists after a manual run.

- [ ] **Step 5: Commit any final verification-driven adjustments**

```bash
git add -A
git commit -m "chore: verify daily static site autopublish"
```
