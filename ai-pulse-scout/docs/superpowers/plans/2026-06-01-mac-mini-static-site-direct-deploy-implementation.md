# Mac Mini Static Site Direct Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the already-generated `data/output/site` static artifact from the Mac mini directly to Vercel hosting, without asking Vercel to rebuild or re-enrich content.

**Architecture:** Keep the existing local content-generation flow on the Mac mini (`site:export` / `build:site`) unchanged for ingestion and LLM enrichment. Replace the current deploy-hook-based publish step with a dedicated shell deploy wrapper that validates the generated static output and deploys that directory with the Vercel CLI as a prebuilt static artifact.

**Tech Stack:** bash, Vercel CLI, Node.js/tsx, macOS launchd, existing AI Pulse Scout static export pipeline

---

## File Map

- Create: `scripts/deploy-static-site.sh` — deploy-only wrapper for `data/output/site` using Vercel CLI
- Modify: `scripts/publish-static-site.sh` — switch the scheduled publish flow from deploy-hook triggering to direct artifact deploy
- Modify: `src/cli/publishStaticSite.ts` — align CLI semantics with direct deploy or retire hook-trigger behavior behind the same local deploy flow
- Modify: `README.md` — document the new Mac-mini-first direct deploy flow, required Vercel CLI login, and verification commands
- Test/Verify: local shell invocation of the new deploy wrapper; manual dry run against generated output; existing publish flow smoke test

---

### Task 1: Add deploy-only shell wrapper

**Files:**
- Create: `scripts/deploy-static-site.sh`

- [ ] **Step 1: Create the deploy wrapper with strict checks**

```bash
#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/data/output/site"
INDEX_FILE="$OUTPUT_DIR/index.html"
DAY_DIR="$OUTPUT_DIR/days"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if ! command -v vercel >/dev/null 2>&1; then
  log "ERROR: vercel CLI not found in PATH."
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  log "ERROR: vercel CLI is not logged in."
  exit 1
fi

if [ ! -f "$INDEX_FILE" ]; then
  log "ERROR: missing static site index: $INDEX_FILE"
  exit 1
fi

if [ ! -d "$DAY_DIR" ] || ! find "$DAY_DIR" -type f -name '*.html' -print -quit | grep -q .; then
  log "ERROR: missing day archive html files under $DAY_DIR"
  exit 1
fi

log "Deploying static artifact directory: $OUTPUT_DIR"
cd "$OUTPUT_DIR"
vercel deploy --prod --yes
```

- [ ] **Step 2: Mark the script executable**

Run: `chmod +x scripts/deploy-static-site.sh`
Expected: command exits 0

- [ ] **Step 3: Smoke-test the wrapper preconditions without deploying a broken path**

Run: `bash scripts/deploy-static-site.sh`
Expected: either a successful production deployment or a clear precondition error (`vercel CLI not found`, `not logged in`, or missing static files)

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy-static-site.sh
git commit -m "feat: add direct static site deploy wrapper"
```

---

### Task 2: Repoint the scheduled publish flow to direct deploy

**Files:**
- Modify: `scripts/publish-static-site.sh`

- [ ] **Step 1: Replace deploy-hook wording and behavior in the publish wrapper**

Replace the body after the Node/version checks so it becomes:

```bash
log "node $(node --version)"
log "project $PROJECT_DIR"
log "=== AI Pulse Scout — Static Site Autopublish ==="
log "Step 1/2: build static site"
./node_modules/.bin/tsx src/cli/buildStaticSite.ts
log "Step 2/2: deploy generated static site"
bash "$PROJECT_DIR/scripts/deploy-static-site.sh"
log "=== Done (OK) ==="
```

- [ ] **Step 2: Run the wrapper manually**

Run: `bash scripts/publish-static-site.sh`
Expected: local build completes first, then direct deploy wrapper runs, and the log file ends with `=== Done (OK) ===`

- [ ] **Step 3: Verify the daily log captures both build and deploy phases**

Run: `tail -n 80 data/logs/static-site-publish-$(date +%Y-%m-%d).log`
Expected: lines showing `Step 1/2: build static site` and `Step 2/2: deploy generated static site`

- [ ] **Step 4: Commit**

```bash
git add scripts/publish-static-site.sh
git commit -m "feat: publish generated static site directly"
```

---

### Task 3: Align the TypeScript publish CLI with the new deploy model

**Files:**
- Modify: `src/cli/publishStaticSite.ts`

- [ ] **Step 1: Replace deploy-hook logic with Vercel CLI invocation**

Update the file so the deploy half uses `vercel deploy --prod --yes` against `data/output/site` instead of POSTing a hook. The key implementation shape should be:

```ts
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`${command} terminated by signal ${signal}`));
      if (code !== 0) return reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
      resolvePromise();
    });
  });
}

export async function runBuildSite(): Promise<void> {
  await runCommand(process.execPath, ['--import', 'tsx', 'src/cli/buildStaticSite.ts'], process.cwd());
}

export async function deployGeneratedSite(): Promise<void> {
  const outputDir = resolve(process.cwd(), 'data/output/site');
  await runCommand('vercel', ['deploy', '--prod', '--yes'], outputDir);
}

export async function main(): Promise<void> {
  console.log('=== AI Pulse Scout — Static Site Autopublish ===');
  console.log('Step 1/2: build static site');
  await runBuildSite();
  console.log('Step 2/2: deploy generated static site');
  await deployGeneratedSite();
  console.log('=== Done (OK) ===');
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  await main();
}
```

- [ ] **Step 2: Run the CLI directly**

Run: `./node_modules/.bin/tsx src/cli/publishStaticSite.ts`
Expected: the command builds the site locally, then deploys from `data/output/site`

- [ ] **Step 3: Commit**

```bash
git add src/cli/publishStaticSite.ts
git commit -m "refactor: deploy static artifact instead of triggering hook"
```

---

### Task 4: Update docs to match the real architecture

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace deploy-hook-based publish wording**

Update the deployment documentation so it says:

```md
### Automated morning site publish

The 07:00 Mac mini job builds the static site locally, including LLM enrichment, and then deploys the generated `data/output/site` artifact directly with the Vercel CLI. Vercel should host the finished static files; it should not be relied on to regenerate digest content during deployment.

Required local setup:

```bash
npm install -g vercel
vercel login
```

Manual verification:

```bash
npm run build:site
bash scripts/deploy-static-site.sh
bash scripts/publish-static-site.sh
```
```

Also remove or rewrite references that imply `VERCEL_DEPLOY_HOOK_URL` is the required deployment path for the scheduled static-site publish flow.

- [ ] **Step 2: Verify README no longer misstates the deployment model**

Run: `rg -n "VERCEL_DEPLOY_HOOK_URL|deploy hook|trigger Vercel deploy hook" README.md src/cli/publishStaticSite.ts scripts/publish-static-site.sh`
Expected: no stale deploy-hook wording remains for the scheduled static-site publish path

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe direct static artifact deploy flow"
```

---

### Task 5: End-to-end verification and push

**Files:**
- Verify existing generated output under: `data/output/site`
- Verify logs under: `data/logs/`

- [ ] **Step 1: Ensure the local build still succeeds before deploy**

Run: `npm run build:site`
Expected: output shows the chosen digest date and writes `data/output/site/index.html`

- [ ] **Step 2: Verify generated artifact exists**

Run: `find data/output/site -maxdepth 2 -type f | sort`
Expected: includes `data/output/site/index.html` and at least one `data/output/site/days/*.html`

- [ ] **Step 3: Run the full publish flow**

Run: `bash scripts/publish-static-site.sh`
Expected: build succeeds, direct deploy succeeds, and no deploy-hook POST occurs

- [ ] **Step 4: Verify the live site reflects the locally generated artifact**

Run:
```bash
python3 - <<'PY'
import re, urllib.request
html = urllib.request.urlopen('https://daily.deanlu.ai', timeout=20).read().decode('utf-8','ignore')
print('cards=', len(re.findall(r'class="digest-card"', html)))
print('fallback_hits=', len(re.findall(r'系统已保留原文链接|建议点击查看完整细节|已进入今日摘要', html)))
PY
```
Expected: live output matches the locally generated artifact characteristics for the tested digest

- [ ] **Step 5: Push the workflow changes**

Run:
```bash
git push origin HEAD:feature/ai-pulse-scout-mvp
```
Expected: push completes successfully

- [ ] **Step 6: Commit any remaining workflow updates**

```bash
git add scripts/deploy-static-site.sh scripts/publish-static-site.sh src/cli/publishStaticSite.ts README.md
git commit -m "feat: deploy mac mini generated static site directly"
```
