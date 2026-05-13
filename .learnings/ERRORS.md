# Errors

Command failures and integration errors.

---

## [ERR-20260513-001] notion_db_inspect_missing_database

**Logged**: 2026-05-13T22:39:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Local Notion DB inspection script failed because one configured database ID is no longer accessible to the integration.

### Error
```
Error: Notion API 错误: Could not find database with ID: 33aec093-c49c-81d9-b581-eddba05a835e. Make sure the relevant pages and databases are shared with your integration "My Notes".
```

### Context
- Command attempted: `node tmp_notion_db_inspect.mjs`
- Environment: local notion-api helper in workspace
- Impact: broad DB listing failed, so KB ingestion needs a more targeted create/update path instead of relying on that inspection script

### Suggested Fix
Avoid assuming all historical database IDs remain shared. Keep a direct, current DL-KB database locator or make the inspector skip inaccessible databases.

### Metadata
- Reproducible: yes
- Related Files: tmp_notion_db_inspect.mjs

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

## [ERR-20260508-001] rg-command-missing

**Logged**: 2026-05-08T16:23:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Attempted to use rg in workspace but ripgrep is not installed in this environment.

### Error


### Context
- Command attempted: rg -n "顾问|二级部门|department|timesheet" /Users/aactest/.openclaw/workspace -S
- Need fallback to grep/find or read known files directly.

### Suggested Fix
Prefer grep -R or direct file reads when rg is unavailable; add this to tool-use habits.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

---

## [ERR-20260509-001] python-openpyxl-import

**Logged**: 2026-05-09T06:55:34+00:00
**Priority**: low
**Status**: pending
**Area**: docs

### Summary
Attempted to read an xlsx file with Python openpyxl, but the module was not installed in the local environment

### Error
```
ModuleNotFoundError: No module named 'openpyxl'
```

### Context
- Command/operation attempted: Python snippet using `from openpyxl import load_workbook`
- Input: `未来两周计划工时不满8小时名单.xlsx`
- Environment: local workspace Python 3 without openpyxl installed

### Suggested Fix
Prefer a dependency-free xlsx parsing approach first, or check available libraries before choosing the parser

### Metadata
- Reproducible: yes
- Related Files: 未来两周计划工时不满8小时名单.xlsx

---
## [ERR-20260509-001] notion-kb-inline-script

**Logged**: 2026-05-09T14:11:30Z
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
Inline Node script for KB Notion page creation failed due to an extra closing parenthesis in the children block builder.

### Error
```text
Expected ',', got ')'
SyntaxError: Unexpected token ')'
```

### Context
- Operation attempted: create a KB page in Notion from an X post
- Environment: inline `node - <<'NODE'` script from workspace root
- Cause: accidental extra `)` at the final `children.push(bul(...))` call

### Suggested Fix
When using long inline scripts for Notion block assembly, either build `children` via array literals carefully or write the script to a temp file and run it to reduce bracket/paren mistakes.

### Metadata
- Reproducible: yes
- Related Files: /Users/aactest/.openclaw/workspace

---
