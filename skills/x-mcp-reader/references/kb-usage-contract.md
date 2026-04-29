# KB Usage Contract

## Handoff to KB workflow

The downstream KB workflow should receive a normalized package with:
- source classification
- retrieval completeness status
- ordered text segments
- extracted outbound links
- notes about missing context or partial thread coverage

## KB formatting expectations

When the downstream workflow writes an X-derived page into Notion:
- keep the compact Chinese overview at the top
- do not place the raw source URL as the first line of body content
- if the source language is non-Chinese, preserve English + Chinese bilingual structure
- keep English and Chinese text in two distinct colors
- explicitly mark partial retrieval before the main body when the source is incomplete

## Source interpretation rules

- `x-post`: treat the post text as the primary body
- `x-thread`: treat the available ordered thread text as the primary body
- `x-share-link`: if the shared external article is accessible and more authoritative, route KB ingestion toward the article itself and treat the X post as context
