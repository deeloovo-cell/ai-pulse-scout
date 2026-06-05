# Errors

Command failures and integration errors.

---

## [ERR-20260531-001] git-show-yaml-pipeline

**Logged**: 2026-05-31T12:15:00+08:00
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
A git-history inspection command failed because YAML output from `git show` was accidentally piped into Python code input instead of being parsed as stdin data.

### Error
```
SyntaxError: invalid syntax
```

### Context
Attempted to inspect historical `config/sources.yaml` revisions by combining `git show ... | python3 - <<'PY'`. The heredoc fed the Python program while the pipe caused YAML lines like `sources:` to be parsed as Python source.

### Suggested Fix
Use either `python3 -c` with stdin piping, or load git output into a temp variable/file before parsing. Avoid mixing a pipe with a heredoc meant for the interpreter source.

### Metadata
- Reproducible: yes
- Related Files: config/sources.yaml

---

## [ERR-20260605-001] pnpm test command unavailable

**Logged**: 2026-06-05T11:58:18.789331+00:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Plan used `pnpm vitest ...` but `pnpm` is not installed in this execution environment.

### Error
```
zsh:1: command not found: pnpm
```

### Context
- Command attempted: `pnpm vitest tests/normalizeRelevance.test.ts -r dot`
- Repo: `/Users/aactest/.config/superpowers/worktrees/workspace/feature/ai-pulse-scout-static-site/ai-pulse-scout`
- Need to detect the actual package manager / test runner command before continuing.

### Suggested Fix
Inspect `package.json` and available package manager binaries, then run the equivalent test command with the repo's actual tooling.

### Metadata
- Reproducible: yes
- Related Files: docs/superpowers/plans/2026-06-05-two-part-summary-relevance-implementation.md

---
