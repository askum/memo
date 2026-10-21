#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Run node server
node server.js

# Close the Terminal window automatically when program exits
osascript -e 'tell application "Terminal" to close (every window whose name contains "MyMemo")' >/dev/null 2>&1
osascript -e 'tell application "Terminal" to close front window' >/dev/null 2>&1
kill -9 $PPID >/dev/null 2>&1
exit 0
