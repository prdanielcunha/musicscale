#!/bin/zsh
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/Library/Application Support/MusicScaleLive"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_DIR/com.millionsnest.musicscale-live-node.plist"
EXE="$INSTALL_DIR/MusicScaleLiveNode"

echo "Instalando MusicScale Live Node..."

mkdir -p "$INSTALL_DIR/web" "$LAUNCH_DIR"
cp "$SOURCE_DIR/MusicScaleLiveNode" "$EXE"
chmod +x "$EXE"
rm -rf "$INSTALL_DIR/web"
cp -R "$SOURCE_DIR/web" "$INSTALL_DIR/web"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.millionsnest.musicscale-live-node</string>
  <key>ProgramArguments</key>
  <array>
    <string>$EXE</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/MusicScaleLiveNode.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/MusicScaleLiveNode.error.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID/com.millionsnest.musicscale-live-node" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST"

sleep 2
open "http://127.0.0.1:4317/node"

echo
echo "MusicScale Live Node instalado."
echo "Ele iniciará automaticamente quando você entrar no macOS."
echo "Na primeira conexão pela rede local, o macOS pode pedir permissão de firewall."
