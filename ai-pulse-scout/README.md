# AI Pulse Scout

A portable TypeScript project that automatically collects AI news from a curated source list, scores and deduplicates items, renders a concise HTML executive digest, and sends it via SMTP.

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
| `config/digest.yaml` | Scoring keywords, max items, collection window |
| `config/email.yaml` | Recipient, subject template, sender address |

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run preview` | Fetch, score, render → save HTML to `data/output/`, print subject |
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
sources.yaml → rssFetcher → normalizeItem → dedupeItems → scoreItem
  → selectItems → renderHtmlEmail → SmtpMailClient
```

State is persisted after a successful send. If sending fails, `last_successful_run` is NOT updated, so the next run catches up automatically.

Backfill runs share the same fetch/score/render pipeline via `runBackfill()` but use a fixed calendar window instead of the state-anchored window, and do not advance `last_successful_run`.

## Email Format

- Subject: `AI Pulse Scout -- MM-DD-YYYY`
- Each item: bold + underlined title, alternating background colors, source link at end
- 8–15 items per digest, ordered by relevance score
