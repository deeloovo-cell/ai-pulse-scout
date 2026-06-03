#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/data/output/site"
INDEX_FILE="$OUTPUT_DIR/index.html"
VERCEL_SCOPE="deeloovo-cells-projects"
VERCEL_PROJECT_ID="prj_OaQefLb6DX9IryOeqlj2w2AGA7DJ"
VERCEL_ORG_ID="team_5MUuieoZ7jWaBHm24OXg4vyp"
VERCEL_PROJECT_NAME="ai-pulse-scout-static"

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

log "Deploying static artifact directory: $OUTPUT_DIR"
cd "$OUTPUT_DIR"
mkdir -p .vercel
cat > .vercel/project.json <<EOF
{"projectId":"$VERCEL_PROJECT_ID","orgId":"$VERCEL_ORG_ID","projectName":"$VERCEL_PROJECT_NAME"}
EOF
vercel deploy --prod --yes --scope "$VERCEL_SCOPE" --project "$VERCEL_PROJECT_NAME"
