#!/bin/bash
# Remove the launchd agent for the daily digest.
set -euo pipefail

LABEL="com.ai-pulse-scout.daily"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ ! -f "$DEST" ]; then
  echo "Not installed: $DEST"
  exit 0
fi

launchctl unload "$DEST" 2>/dev/null || true
rm "$DEST"
echo "Uninstalled: $DEST"
