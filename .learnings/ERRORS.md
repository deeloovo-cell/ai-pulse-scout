# Errors

Command failures and integration errors.

---

## [ERR-20260503-001] notion-ludi-script-path

**Logged**: 2026-05-03T10:30:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Skill docs referenced scripts/ paths that do not exist in this workspace root, so direct script invocation failed.

### Error
```
ls: scripts: No such file or directory
```

### Context
Attempted to follow notion-ludi examples using workspace-root scripts. The current workspace does not contain a scripts directory at root. Need to locate actual Notion access path or use alternative tools directly.

### Suggested Fix
Prefer discovering available local tooling before relying on skill example paths; treat examples as conceptual when workspace layout differs.

### Metadata
- Reproducible: yes
- Related Files: /opt/homebrew/lib/node_modules/openclaw/skills/notion-ludi/SKILL.md

---

## [ERR-20260503-002] exec-node-stdin-preflight

**Logged**: 2026-05-03T10:45:00+08:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
OpenClaw exec refused a `node - <<NODE` inline interpreter command due to preflight validation.

### Error
```
exec preflight: complex interpreter invocation detected; refusing to run without script preflight validation. Use a direct `python <file>.py` or `node <file>.js` command.
```

### Context
Need to prefer writing temporary script files and executing them directly instead of heredoc node/python invocations in this environment.

### Suggested Fix
Use `write` to create a script in workspace and run `node path/to/script.mjs`.

### Metadata
- Reproducible: yes

---
## [ERR-20260506-001] notion database lookup

**Logged**: 2026-05-06T09:30:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Cached/local KB database id was no longer accessible to the current Notion integration.

### Error
```
Notion API 错误: Could not find database with ID: 33aec093-c49c-81d9-b581-eddba05a835e. Make sure the relevant pages and databases are shared with your integration "My Notes".
```

### Context
- Operation attempted: summarize/inspect Notion KB database via local helper script
- Trigger: KB ingestion workflow for a martinfowler.com article
- Impact: must rediscover accessible DL-KB database dynamically instead of relying on stale id

### Suggested Fix
Search Notion by database/page title at runtime and avoid assuming the previous DL-KB database id remains valid.

### Metadata
- Reproducible: unknown
- Related Files: tmp_notion_summarize_db.mjs, tmp_create_kb_record.mjs

---
## [ERR-20260506-002] kb create command quoting

**Logged**: 2026-05-06T14:21:40+08:00
**Priority**: low
**Status**: pending
**Area**: docs

### Summary
A KB record creation shell command failed because a Chinese closing quote was embedded in the summary argument, causing shell parsing failure.

### Error
```
zsh:105: unmatched "
```

### Context
- Operation attempted: create Notion KB record for Anthropic finance agents article
- Cause: mixed smart quote / plain quote in long shell argument

### Suggested Fix
When passing long multilingual summaries to shell commands, write arguments via temp files or use JSON-safe/ENV-safe quoting instead of inline long quoted strings.

### Metadata
- Reproducible: yes
- Related Files: tmp_create_kb_record.mjs
- See Also: ERR-20260506-001

---
