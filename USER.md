# USER.md - About Your Human

_Learn about the person you're helping. Update this as you go._

- **Name:**
- **What to call them:**
- **Pronouns:** _(optional)_
- **Timezone:**
- **Notes:**

## Context

_(What do they care about? What projects are they working on? What annoys them? What makes them laugh? Build this over time.)_

- For `KB + <link>` requests: default behavior is to read the link, write a KB-style Chinese summary, and save it into the Notion knowledge base.
- For all articles saved into the Notion knowledge base, English and Chinese text must use two different colors so the languages are visually distinct throughout the page.
- Hard rule: no matter which ingestion path is used, if a knowledge-base page contains both English and Chinese, the two languages must be rendered in two different colors. This is mandatory, not best-effort.
- For emails generated from `source-inbox.md` items, omit these sections by default: `CIO / AI Lead:`, `Why it matters for AAC:`, and `Sources:`.
- For `KB:` requests using X / Twitter links, prefer X MCP retrieval when available before older fallback fetch methods.
- For `arx + <arXiv link>` requests: this is the arXiv-specific variant of the same knowledge-base workflow; save it into the Notion knowledge base as a long-summary entry rather than full text.
- Preferred `arx` summary format: KB-style — start with a Chinese overview, then break down key insights in sections/points.
- Include the source link in the Notion `URL` property.
- For WeRead / 微信读书笔记 imports, default workflow is: user sends an exported file (prefer HTML/TXT/Markdown), and the agent imports it into the Notion `Reading Notes` database by matching existing books first, creating new records only when needed.
- Suggested WeRead trigger phrase: `WR + 文件` or `导入微信读书笔记到 Reading Notes`.

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
