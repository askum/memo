#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "========================================="
echo "  Desktop Memo 시작 중..."
echo "========================================="

node server.js
