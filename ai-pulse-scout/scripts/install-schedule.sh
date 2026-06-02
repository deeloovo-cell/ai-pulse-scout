#!/bin/bash
# Install the launchd agent that runs the daily 07:00 static-site publish.
# Safe to re-run — reloads if already installed.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.ai-pulse-scout.daily"
TEMPLATE="$PROJECT_DIR/scripts/$LABEL.plist"
AGENTS_DIR="$HOME/Library/LaunchAgents"
DEST="$AGENTS_DIR/$LABEL.plist"

mkdir -p "$AGENTS_DIR"

# Substitute __PROJECT_DIR__ placeholder with the real path
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE" > "$DEST"

echo "Wrote: $DEST"

# Unload first if already loaded (ignore errors)
launchctl unload "$DEST" 2>/dev/null || true

launchctl load "$DEST"

echo ""
echo "Scheduled: daily static-site publish at 07:00 host local time"
echo "  Status : launchctl list $LABEL"
echo "  Logs   : tail -f $PROJECT_DIR/data/logs/static-site-publish-\$(date +%Y-%m-%d).log"
echo "  Remove : npm run schedule:uninstall   (from project dir)"
