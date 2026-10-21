@echo off
setlocal
cd /d "%~dp0"

echo [1/3] 가상환경 확인 및 PyInstaller 준비 중...
if not exist ".venv" (
    python -m venv .venv
)
call .venv\Scripts\activate
pip install pyinstaller

echo [2/3] MyMemo.exe 빌드 시작...
pyinstaller --noconsole --onefile -n "MyMemo" --clean --noconfirm main.py

echo [3/3] 빌드 완료!
echo dist\MyMemo.exe 파일이 생성되었습니다.
pause
