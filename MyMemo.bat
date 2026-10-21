@echo off
cd /d "%~dp0"

echo =========================================
echo   Desktop Memo 시작 중...
echo =========================================

node server.js

if errorlevel 1 (
    echo.
    echo Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 설치해 주시거나,
    echo standalone.html 파일을 더블 클릭하여 브라우저에서 바로 사용하실 수 있습니다.
    pause
)
