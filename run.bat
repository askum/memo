@echo off
setlocal
cd /d "%~dp0"

REM Check if Python virtual environment exists
if not exist ".venv" (
    echo [INFO] 가상환경을 생성하는 중입니다...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Python이 설치되어 있지 않거나 PATH에 등록되어 있지 않습니다.
        pause
        exit /b 1
    )
    echo [INFO] 필요한 패키지를 설치하는 중입니다...
    call .venv\Scripts\activate
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate
)

echo [INFO] 데스크톱 메모를 시작합니다...
python main.py

if errorlevel 1 (
    echo [ERROR] 프로그램 실행 중 오류가 발생했습니다.
    pause
)
