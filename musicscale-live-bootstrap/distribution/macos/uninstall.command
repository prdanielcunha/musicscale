#!/bin/zsh
set -euo pipefail

INSTALL_DIR="$HOME/Library/Application Support/MusicScaleLive"
PLIST="$HOME/Library/LaunchAgents/com.millionsnest.musicscale-live-node.plist"

launchctl bootout "gui/$UID/com.millionsnest.musicscale-live-node" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -rf "$INSTALL_DIR"

echo "MusicScale Live Node removido."
