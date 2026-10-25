@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo =========================================
echo   데스크톱 메모 시작 중...
echo =========================================

node server.js
exit
