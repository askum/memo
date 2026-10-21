#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

export TK_SILENCE_DEPRECATION=1

# Run using virtual environment if it exists, otherwise system python
if [ -f ".venv/bin/python3" ]; then
    exec .venv/bin/python3 main.py
else
    exec python3 main.py
fi
