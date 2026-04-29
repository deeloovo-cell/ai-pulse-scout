# Setup and Verification

## Expected environment

This skill assumes an X-capable MCP server exists and is already installable in the local environment or OpenClaw host environment.

This skill does not assume:
- automatic dependency discovery
- automatic installation of unknown third-party MCP servers
- automatic repair of external MCP auth or quota issues

## Verification checklist

Before using this skill in a KB flow, verify:
1. The MCP server is configured in the environment where the agent runs.
2. The MCP integration exposes a tool or resource capable of reading an X post or thread.
3. A public sample X URL returns actual body content rather than a shell summary.
4. The returned content includes enough structure to distinguish single posts, threads, and partial retrieval.

## Failure diagnosis

Common failure categories:
- MCP server missing
- MCP server installed but not connected to the runtime
- auth or entitlement failure
- response contains only metadata or summary, not body text
- thread expansion incomplete
- returned links are present but the core post text is absent

When diagnosing, record which category occurred before falling back to older fetch paths.
