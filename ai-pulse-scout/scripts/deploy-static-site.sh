#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/data/output/site"
INDEX_FILE="$OUTPUT_DIR/index.html"
DAY_DIR="$OUTPUT_DIR/days"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if ! command -v vercel >/dev/null 2>&1; then
  log "ERROR: vercel CLI not found in PATH."
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  log "ERROR: vercel CLI is not logged in."
  exit 1
fi

if [ ! -f "$INDEX_FILE" ]; then
  log "ERROR: missing static site index: $INDEX_FILE"
  exit 1
fi

if [ ! -d "$DAY_DIR" ] || ! find "$DAY_DIR" -type f -name '*.html' -print -quit | grep -q .; then
  log "ERROR: missing day archive html files under $DAY_DIR"
  exit 1
fi

log "Deploying static artifact directory: $OUTPUT_DIR"
cd "$OUTPUT_DIR"
vercel deploy --prod --yes
