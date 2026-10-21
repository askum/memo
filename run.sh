#!/usr/bin/env bash
set -e

# Resolve script directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Check if .venv exists, if not create and install dependencies
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    echo "Installing requirements..."
    .venv/bin/pip install -r requirements.txt
fi

echo "Starting Desktop Memo..."
export TK_SILENCE_DEPRECATION=1
exec .venv/bin/python3 main.py
