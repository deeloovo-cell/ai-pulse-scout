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
