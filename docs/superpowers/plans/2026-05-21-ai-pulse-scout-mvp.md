# AI Pulse Scout MVP — Implementation Plan

Date: 2026-05-21
Status: In Progress

## Phases

### Phase 1 — Project skeleton
- package.json, tsconfig.json, .env.example, README
- Install deps: rss-parser, nodemailer, js-yaml, dotenv, date-fns
- Dev: vitest, tsx, typescript, @types/*

### Phase 2 — Types and config
- src/types/item.ts — NormalizedItem, ContentType, RelevanceScores
- src/types/config.ts — SourceConfig, DigestConfig, EmailConfig
- config/sources.yaml, digest.yaml, email.yaml
- src/config/loadConfig.ts

### Phase 3 — State management
- src/state/runState.ts — last_successful_run.json read/write
- src/state/ledger.ts — sent_ledger.jsonl append + lookup

### Phase 4 — Fetching and normalization
- src/fetchers/rssFetcher.ts — RSS/Atom feed fetch with window
- src/normalize/fingerprint.ts — URL + title → hash fingerprint
- src/normalize/normalizeItem.ts — RSS item → NormalizedItem

### Phase 5 — Filtering and scoring
- src/filtering/scoreItem.ts — keyword-based heuristic scores
- src/filtering/dedupeItems.ts — ledger + fingerprint check
- src/filtering/selectItems.ts — top-N by score

### Phase 6 — Rendering
- src/render/renderHtmlEmail.ts — HTML digest with bold+underline titles, alternating colors

### Phase 7 — Mail adapter
- src/mail/MailClient.ts — interface
- src/mail/SmtpMailClient.ts — nodemailer SMTP impl

### Phase 8 — CLI commands
- src/cli/preview.ts — fetch → render → save HTML artifact, print subject
- src/cli/sendTest.ts — full pipeline → SMTP send

### Phase 9 — Tests
- tests/fingerprint.test.ts
- tests/dedupe.test.ts
- tests/runState.test.ts
- tests/render.test.ts

### Phase 10 — Verification
- npm test (all pass)
- npm run preview (saves HTML to data/output/)
