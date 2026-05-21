#!/bin/bash
# Daily digest runner invoked by launchd (or manually).
# Logs everything to data/logs/digest-YYYY-MM-DD.log.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/data/logs"
LOG_FILE="$LOG_DIR/digest-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1  # all subsequent output goes to the log file

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== Daily digest starting ==="

# launchd has a minimal PATH; add common Node.js install locations
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

cd "$PROJECT_DIR"

if ! command -v node &>/dev/null; then
  log "ERROR: node not found in PATH. Add your node install dir to PATH in this script."
  exit 1
fi

log "node $(node --version)"
log "project $PROJECT_DIR"

./node_modules/.bin/tsx src/cli/sendTest.ts

log "=== Done (OK) ==="
