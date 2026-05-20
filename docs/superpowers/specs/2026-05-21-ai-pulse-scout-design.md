# AI Pulse Scout — Design Spec

Date: 2026-05-21
Status: Draft approved for spec write-up
Owner context: 卢迪

## 1. Goal

Build a portable **AI Pulse Scout** project that automatically collects updates from a curated source list, selects the most relevant signals, renders a concise HTML executive digest, and sends it daily at **7:00 AM** to **deeloovo@gmail.com**.

Primary runtime should be **OpenClaw-triggered automation**, but the codebase must remain portable so it can be moved into another IDE such as Cursor without being tightly coupled to OpenClaw.

## 2. User Requirements

### Functional requirements

1. Consume content from the provided source list, grouped across:
   - Core AI Engineering & Agentic AI
   - Industrial AI / Manufacturing AI
   - AI for CAD / CAE / CAM
   - YouTube channels
   - Podcasts
   - RSS / newsletters
   - Research sources
   - Open source / communities
   - AI leaders / influencers
   - Third-party professional AI websites
2. Retrieve content from the previous day or since the last successful send.
3. Ensure no relevant content is missed between one successful send and the next.
4. Deduplicate repeated items across runs and across overlapping fetch windows.
5. Produce digest items with up to three sections:
   - Breakthrough / Key insights
   - What I, as CIO and AI Lead, should be aware of
   - Why it matters for AAC technologies
6. The AAC section must only appear when there is a real, supportable AAC relevance. If not relevant, omit it.
7. Render the digest as **HTML email**.
8. Send the digest to **deeloovo@gmail.com**.
9. Use email subject format: **AI Pulse Scout -- MM-DD-YYYY**.
10. Run automatically every day at **7:00 AM**.

### Formatting requirements

1. Each item title must be **bold** and **underscored**.
2. Each item should use alternating colors for visual separation.
3. The source link must appear at the end of each item.
4. The digest should be short, executive-readable, and suitable for Gmail.
5. Final digest language: **English only**.

### Operational requirements

1. Delivery should be **fully automatic** with no review gate before send.
2. Dedupe and catch-up logic should use **both**:
   - time windowing based on last successful run
   - a persistent sent-item ledger
3. Mail delivery should use a **mail adapter abstraction**, with **SMTP first** and a clean future path to Gmail API.

## 3. Non-Goals for v1

The first version will not include:

1. Full transcription of all YouTube videos or podcasts.
2. Heavy browser automation for all sources.
3. Gmail API as the first sender implementation.
4. ML-based ranking or advanced recommendation systems.
5. Deep technical summarization beyond what the fetched source reasonably supports.
6. Human approval workflow before sending.

## 4. Recommended Architecture

Recommended implementation approach: **Hybrid pipeline**.

This means:

1. Use RSS/Atom feeds wherever available as the default retrieval path.
2. Add source-specific adapters only where feed support is weak or absent.
3. Normalize all fetched content into a common item model.
4. Apply shared dedupe, scoring, selection, and rendering logic.
5. Use OpenClaw as the default daily trigger, while keeping the application runnable as a normal standalone Node/TypeScript project.

This approach is preferred because it balances delivery speed, reliability, extensibility, and portability.

## 5. Project Structure

```text
ai-pulse-scout/
  README.md
  package.json
  .env.example

  config/
    sources.yaml
    digest.yaml
    email.yaml

  src/
    index.ts
    types/
      item.ts
      config.ts
      run.ts

    config/
      loadConfig.ts

    fetchers/
      rssFetcher.ts
      youtubeFetcher.ts
      podcastFetcher.ts
      githubFetcher.ts
      webPageFetcher.ts
      registry.ts

    normalize/
      normalizeItem.ts
      canonicalizeUrl.ts
      fingerprint.ts

    filtering/
      scoreItem.ts
      selectItems.ts
      dedupeItems.ts

    briefing/
      composeInsight.ts
      composeCioNote.ts
      composeAacImpact.ts
      buildDigest.ts

    render/
      renderHtmlEmail.ts
      renderPlainTextFallback.ts

    mail/
      MailClient.ts
      SmtpMailClient.ts

    state/
      ledger.ts
      runState.ts
      sourceCursor.ts

    jobs/
      runDailyDigest.ts

    cli/
      preview.ts
      sendTest.ts
      backfill.ts
      validateSources.ts

    utils/
      logger.ts
      time.ts
      retry.ts

  data/
    state/
    cache/
    output/
    logs/
```

## 6. Core Data Model

Every fetched item should be normalized into a common schema.

### Normalized item

Required fields:

- `id`
- `source_name`
- `source_category`
- `source_url`
- `item_url`
- `title`
- `published_at`
- `fetched_at`
- `author`
- `content_text`
- `content_html` (optional)
- `summary`
- `tags`
- `content_type`
- `fingerprint`
- `relevance_scores`
- `decision`
- `decision_reason`

### Content types

Supported v1 content types:

- `article`
- `newsletter`
- `video`
- `podcast`
- `research`
- `repo_update`

### Relevance scores

Each item should support scoring dimensions such as:

- `ai_engineering`
- `industrial_ai`
- `cad_cae_cam`
- `executive_signal`
- `aac_relevance`

Scoring is heuristic and rule-based in v1.

## 7. State and Reliability Model

To avoid misses and repeats, the system must persist both run metadata and sent-item history.

### Required state files

- `data/state/last_successful_run.json`
  - stores the last fully successful digest run and send timestamp
- `data/state/sent_ledger.jsonl`
  - append-only record of sent items by fingerprint and URL
- `data/state/source_cursors.json`
  - optional per-source checkpoint data for adapters that need it

### Catch-up rule

Each run should fetch from:

- `last_successful_run - safety_buffer`

The overlap buffer prevents loss due to clock skew, feed delay, or inconsistent publication timestamps.

### Deduplication rule

An item is treated as already delivered if either of the following matches an existing sent ledger entry:

- canonical item URL
- item fingerprint

### Success rule

A run only updates `last_successful_run` after the email has been sent successfully.

If sending fails, the run must not advance the success marker. This ensures the next run catches up instead of skipping content.

## 8. Source Handling Rules

### 8.1 RSS / blog / newsletter sources

Default retrieval path:

1. Use the source feed when available.
2. Collect items within the collection window.
3. If publication time is missing or unreliable, use fetch time and rely on ledger-based dedupe.

### 8.2 YouTube channels

Use channel feeds when available.

Extract:

- title
- publication time
- URL
- description

Do not transcribe entire videos by default.
Only use title and description unless a later version explicitly adds transcript support.

### 8.3 Podcasts

Use podcast RSS feeds.

Extract:

- episode title
- published time
- show notes or summary
- item URL

Do not transcribe full audio in v1.

### 8.4 GitHub and open source sources

Track only high-signal changes such as:

- releases
- changelog updates
- major README / roadmap / docs changes

Do not summarize ordinary low-signal commit noise.

### 8.5 Research sources

For research pages and arXiv-style sources:

- include only items within the collection window
- prefer official title + abstract + publication metadata
- do not overclaim novelty beyond source evidence

### 8.6 Company and industrial AI sources

These sources often contain marketing-heavy content. Include an item only when it has clear signal such as:

- meaningful product release
- engineering detail
- customer deployment pattern
- benchmark or capability change
- operational implication for AI leaders / CIOs

Otherwise drop as low-signal.

## 9. Selection Logic

Each candidate item flows through the following stages:

1. **Freshness check**
   - item falls inside the effective collection window
2. **Deduplication check**
   - item is removed if URL or fingerprint already exists in ledger
3. **Signal threshold check**
   - item must contain substantive new information
4. **Digest-fit check**
   - item must support at least one digest purpose:
     - breakthrough / key insight
     - CIO / AI Lead awareness
     - AAC relevance

### Digest size target

Daily digest target should be **8–15 items maximum**.

Items should be ordered by importance, not by source list order.

## 10. Briefing Logic

Each selected item should render using the following structure.

### 10.1 Breakthrough / Key insight

- required
- short paragraph
- focused on the genuinely new or notable signal

### 10.2 What I, as CIO and AI Lead, should be aware of

- required
- short paragraph
- focused on architecture, governance, tooling, organization, workflow, infrastructure, or vendor implications

### 10.3 Why it matters for AAC technologies

- optional
- include only when there is a real connection
- omit entirely if there is no defensible AAC relevance

### AAC relevance rule

AAC relevance is valid only when the source materially connects to one or more of:

- agentic workflows for enterprise use
- industrial or manufacturing AI deployment
- CAD / CAE / CAM workflows
- infrastructure, governance, deployment, or tooling choices AAC could plausibly act on
- meaningful AI platform shifts affecting vendor or architecture decisions relevant to AAC

If none applies, omit the AAC subsection. The system must not fabricate AAC impact.

## 11. HTML Email Rules

### Subject

- `AI Pulse Scout -- MM-DD-YYYY`

### Body requirements

1. HTML email with compact executive layout.
2. Each item title is both:
   - bold
   - underscored
3. Item blocks use alternating colors for visual separation.
4. Source link appears at the end of each item.
5. HTML should be Gmail-safe:
   - prefer inline styles
   - keep layout simple
   - avoid fragile rendering patterns

### Item rendering structure

Each item should contain:

1. Title line
2. Breakthrough / Key insight section
3. CIO / AI Lead awareness section
4. Optional AAC section
5. Source link

## 12. Scheduling and Runtime

### Primary runtime

- OpenClaw-triggered workflow
- scheduled daily at **7:00 AM**

### Execution sequence

1. Load config.
2. Read last successful run state.
3. Compute collection window with safety overlap.
4. Fetch source updates.
5. Normalize items.
6. Deduplicate items.
7. Score and select top items.
8. Compose digest commentary.
9. Render HTML email.
10. Send email through mail adapter.
11. Persist artifacts and update success state.

### Failure handling

If source fetching partially fails:

- continue processing successful sources
- log failures clearly for later inspection

If email sending fails:

- keep generated output artifact
- do not update `last_successful_run`
- allow the next run to catch up safely

## 13. Mail Delivery Design

Mailing should be abstracted behind an interface.

### Required interface

- `MailClient`
  - send HTML email
  - support subject, recipient, HTML body, and optional plain text fallback

### v1 implementation

- `SmtpMailClient`

### Future extension

- `GmailApiMailClient`

This design keeps the code portable and avoids locking implementation details into the digest pipeline.

## 14. Technology Choice

Recommended stack:

- **Node.js + TypeScript**

Reasons:

1. Portable into Cursor and other IDEs.
2. Strong ecosystem for feeds, HTML generation, and mail delivery.
3. Good fit for scheduled jobs and CLI tooling.
4. Easier to keep structured and maintainable than an ad hoc script set.

## 15. CLI and Developer Workflow

The project should expose local commands for development and portability.

### Required CLI flows

- preview a digest without sending email
- send a test email
- backfill a custom date range if needed
- validate configured sources

This ensures the same code can run under OpenClaw scheduling or standalone in another environment.

## 16. Testing and Verification Strategy

Before declaring the project complete, verify the following:

### Source fetch behavior

- representative feeds load successfully
- malformed or failing sources degrade gracefully

### Dedupe and catch-up

- repeated runs do not resend the same item
- failed sends do not cause content loss
- overlap windows do not create duplicate delivery

### Rendering

- HTML renders correctly in Gmail-like clients
- titles are bold and underscored
- alternating item colors are visible and readable
- source links appear at the end of each item

### Selection quality

- obvious marketing fluff is dropped where possible
- low-signal changes are excluded
- AAC section is omitted when not justified

### Manual preview before activation

- generate and inspect at least one local preview digest
- save HTML output artifact for review before enabling automation

## 17. Initial Implementation Boundaries

Version 1 should prioritize reliability and clarity over coverage perfection.

### Must include in v1

- portable TypeScript project structure
- config-driven source registry
- hybrid fetching approach
- normalized item pipeline
- dedupe with time-window + ledger
- HTML executive email rendering
- SMTP-backed mail adapter
- scheduled daily job entrypoint
- preview/test flows

### May be added later

- Gmail API sender
- transcript support
- richer source adapters
- smarter ranking logic
- admin dashboards or web UI

## 18. Final Design Decision Summary

Build a **portable TypeScript project** named around the AI Pulse Scout concept, scheduled by **OpenClaw at 7:00 AM**, using a **hybrid source-fetching pipeline**, with **window + ledger dedupe**, **SMTP-first mail delivery**, and **HTML executive digest rendering**.

The digest must stay concise, must be written in **English**, must include CIO/AI Lead framing, and must include AAC impact only when it is real and defensible.
