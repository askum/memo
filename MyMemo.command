#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Launch node server detached in background so Terminal has no running child process
nohup node server.js >/dev/null 2>&1 &

# Close this Terminal window immediately without any prompt
osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1 &
exit 0
