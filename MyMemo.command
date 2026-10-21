#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Ensure Homebrew and standard binary paths are available in GUI/Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Launch node server detached in background
nohup node server.js >/dev/null 2>&1 &

# Close this Terminal window immediately without any prompt
osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 &
exit 0
