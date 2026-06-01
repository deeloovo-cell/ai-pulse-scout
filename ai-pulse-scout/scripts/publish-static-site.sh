#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/data/logs"
LOG_FILE="$LOG_DIR/static-site-publish-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== Daily static-site publish starting ==="

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$PROJECT_DIR"

if ! command -v node &>/dev/null; then
  log "ERROR: node not found in PATH."
  exit 1
fi

log "node $(node --version)"
log "project $PROJECT_DIR"
log "=== AI Pulse Scout — Static Site Autopublish ==="
log "Step 1/2: build static site"
./node_modules/.bin/tsx src/cli/buildStaticSite.ts
log "Step 2/2: deploy generated static site"
bash "$PROJECT_DIR/scripts/deploy-static-site.sh"
log "=== Done (OK) ==="
