# AI Pulse Scout

A portable TypeScript project that automatically collects recent AI updates from a curated source list, deduplicates items, uses GLM to generate concise key insights, renders an HTML executive digest, and sends it via SMTP.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your SMTP credentials

npm install
npm run preview        # Generate HTML digest to data/output/ (no email sent)
npm run send-test      # Send a test digest to your configured recipient
npm test               # Run test suite
```

## Configuration

| File | Purpose |
|------|---------|
| `config/sources.yaml` | RSS/feed source list, grouped by category |
| `config/digest.yaml` | Max items and 24-hour collection window |
| `config/email.yaml` | Recipient, subject template, sender address |

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run preview` | Fetch, dedupe, analyze, render → save HTML to `data/output/`, print subject |
| `npm run send-test` | Full pipeline including SMTP send |
| `npm run backfill -- --days 7` | Preview a 7-day lookback digest (no email, no state changes) |
| `npm run backfill -- --days 7 --send` | Send a 7-day backfill digest via SMTP (updates ledger, not `last_successful_run`) |
| `npm run validate-sources` | Ping all configured feeds, report status |

### Backfill flags

| Flag | Default | Description |
|------|---------|-------------|
| `--days N` | `7` | Lookback window in days |
| `--send` | off | Send the digest via SMTP; requires SMTP credentials in `.env` |

**Backfill semantics:**
- Preview (no `--send`): uses an empty ledger — shows all items published in the window regardless of prior sends. No state files are modified.
- Send (`--send`): checks the real sent ledger to avoid duplicates, then appends newly sent items to it. `last_successful_run` is **not** advanced, so the normal daily cadence is preserved.
- Output artifact is saved to `data/output/digest-backfill-YYYY-MM-DD-Nd.html`.

## State Files

| File | Purpose |
|------|---------|
| `data/state/last_successful_run.json` | Timestamp of last fully delivered digest |
| `data/state/sent_ledger.jsonl` | Append-only record of sent items (URL + fingerprint) |

## Architecture

```
sources.yaml → rssFetcher → normalizeItem → dedupeItems
  → selectItems → enrichKeyInsights → renderHtmlEmail → SmtpMailClient
```

State is persisted after a successful send. If sending fails, `last_successful_run` is NOT updated, so the next run catches up automatically.

Backfill runs share the same fetch/score/render pipeline via `runBackfill()` but use a fixed calendar window instead of the state-anchored window, and do not advance `last_successful_run`.

## Email Format

- Subject: `AI Pulse Scout -- MM-DD-YYYY`
- Each item: bold + underlined title, alternating background colors, source link at end
- 8–15 items per digest, ordered by relevance score

## Daily Automation (macOS launchd)

The project ships a launchd-based scheduler that fires `scripts/send-daily.sh` every day at **07:00 host local time**.

### One-time install

```bash
npm run schedule:install
```

This:
1. Substitutes the project path into `scripts/com.ai-pulse-scout.daily.plist`
2. Writes the final plist to `~/Library/LaunchAgents/com.ai-pulse-scout.daily.plist`
3. Loads it with `launchctl load`

The agent is persistent across reboots (LaunchAgents load automatically on login).

### Verification

```bash
npm run schedule:status           # should show PID and LastExitStatus
launchctl list com.ai-pulse-scout.daily
```

### Manual send (same command the scheduler uses)

```bash
npm run send-daily                # or: bash scripts/send-daily.sh
```

### Logs

Each run appends to `data/logs/digest-YYYY-MM-DD.log`. The launchd-level wrapper logs go to `data/logs/launchd-stdout.log` / `launchd-stderr.log`.

```bash
tail -f data/logs/digest-$(date +%Y-%m-%d).log
```

### Remove the schedule

```bash
npm run schedule:uninstall
```

### Source Universe Coverage

Run this to validate how the raw inbox source universe is currently classified and traversed:

```bash
npm run coverage:sources
```

This command:
- parses `config/source-inbox.md`
- classifies every inbox URL
- runs coverage validation across the full source universe
- flags unreadable URLs for removal from the active source set
- writes results to `data/output/source-coverage/latest.json`

### Timezone note

launchd `StartCalendarInterval` fires on **host local time**. If the machine clock is set to Asia/Shanghai the job fires at 07:00 CST. No extra timezone configuration is required on a correctly-set machine.
