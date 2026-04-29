---
name: x-mcp-reader
description: Read X / Twitter post and thread links through an installed X MCP integration, primarily for KB ingestion and fallback-resistant content retrieval. Use when the user provides an X link, especially in `KB:` workflows, and the goal is to obtain reliable post/thread text, detect partial retrieval, and pass normalized content into a downstream knowledge-base workflow.
---

# x-mcp-reader

Use this skill when an X / Twitter URL should be read through an MCP integration rather than relying only on normal webpage fetches.

For this workspace, prioritize `x-mcp-reader` for `KB:` requests whose primary source is an X / Twitter post or thread.

Default behavior:
- Treat single-post and thread reading as the first-stage responsibility of this skill.
- Do not write directly into Notion from this skill.
- Produce a normalized content package for downstream KB formatting.
- If the MCP can only provide partial content, preserve that limitation explicitly.

## Core workflow

1. Confirm the source is an X / Twitter link.
2. Decide whether the X post is itself the primary source or mainly a wrapper around an external article.
3. If the X post or thread itself is the source, prefer X MCP retrieval first.
4. If the MCP returns incomplete coverage, label the result `partial`.
5. If the MCP is unavailable, label the result `unavailable` and let the downstream KB workflow decide whether to use older fallback fetchers.
6. Do not claim completeness unless the MCP output clearly covers the usable post or thread body.

## Normalized content package

Return or reason with a normalized content package that includes at least:
- `source_type`: `x-post` | `x-thread` | `x-share-link`
- `status`: `full` | `partial` | `unavailable`
- `url`
- `author`
- `published_at` when available
- `body_segments` in reading order
- `discovered_links` extracted from the content when available
- `notes` for truncation, missing replies, auth limits, or ambiguity

## Decision rules

1. If the X post mainly shares an external article and that article is the real primary source, prefer the original article for KB ingestion.
2. If the X post or thread is itself the primary source, prefer MCP retrieval before webpage-based fallbacks.
3. If MCP output is incomplete, label the result `partial` and do not imply full coverage.
4. If MCP is unavailable, label the result `unavailable` and let downstream KB logic decide whether to use fallback fetchers.
5. If fallback content conflicts with MCP content, trust MCP as the primary source of truth for the X text.

## KB handoff

When handing off to a KB workflow:
- Preserve the normalized content package.
- Preserve explicit notes about missing context.
- Keep outbound links discovered from the X content.
- Allow the KB workflow to decide whether the X content should be stored directly or whether an external linked article should become the main KB body.

## References

- `references/setup-and-verification.md` — MCP dependency expectations, setup assumptions, and diagnosis workflow
- `references/kb-usage-contract.md` — KB-specific handoff contract and formatting expectations
