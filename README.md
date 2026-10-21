# 📝 폴더 트리형 데스크톱 메모 (Desktop Memo)

파이썬 네이티브 GUI 기반으로 제작된 **폴더/파일 트리 탐색기 + 실시간 에디터** 데스크톱 메모 프로그램입니다.
까만 화면이나 렌더링 오류 없이 macOS / Windows 네이티브 테마로 빠르고 안정적으로 동작합니다.

---

## ✨ 핵심 기능

1. **📂 폴더 선택 & 트리 탐색기 (좌측 패널)**
   - **폴더 변경**: 상단 `[폴더 변경...]` 버튼으로 컴퓨터의 원하는 폴더(예: 문서, iCloud, Dropbox, 특정 작업 디렉토리)를 메모 저장소로 지정
   - **트리 뷰**: 하위 폴더와 파일(`.md`, `.txt`)을 계층 트리 구조(`📁 폴더`, `📝 파일`)로 표시
   - **새 메모 만들기 (`+ 📝 새 메모`)**: 현재 선택된 폴더 위치에 새 마크다운 파일 생성
   - **새 폴더 만들기 (`+ 📁 새 폴더`)**: 하위 폴더 생성
   - **우클릭 컨텍스트 메뉴**:
     - 📝 새 메모... / 📁 새 폴더...
     - ✏️ 이름 변경 (파일/폴더)
     - 🗑️ 삭제 (휴지통/삭제 확인)
     - 📂 파인더/탐색기에서 열기

2. **📝 실시간 메모 편집기 (우측 패널)**
   - 좌측 트리에서 파일을 클릭하면 즉시 열려 내용 수정
   - **실시간 자동 저장**: 입력 중 500ms 후 자동으로 파일에 저장되며, 우측 상단에 `💾 저장됨` 상태 표시
   - `Cmd+S` (Windows: `Ctrl+S`) 즉시 저장 지원
   - 하단 상태 바: 총 글자 수, 단어 수, 현재 줄/열 번호 표시

3. **⚡ 무설치 파일 더블 클릭 실행**
   - **Mac**: [`dist/MyMemo.app`](file:///Users/askum/workspace_gemini/memo/dist/MyMemo.app) 또는 [`MyMemo.command`](file:///Users/askum/workspace_gemini/memo/MyMemo.command) 더블 클릭
   - **Windows**: [`MyMemo.vbs`](file:///Users/askum/workspace_gemini/memo/MyMemo.vbs) 더블 클릭

---

## ⌨️ 단축키
- `Cmd + S` (Windows: `Ctrl + S`): 메모 저장
- `Cmd + N` (Windows: `Ctrl + N`): 새 메모 만들기
- `Cmd + O` (Windows: `Ctrl + O`): 작업 폴더 선택
- `F5`: 트리 새로고침

---

## 📂 프로젝트 구조
```
memo/
├── app/
│   ├── config.py             # 마지막 열었던 폴더 및 설정 관리
│   ├── file_manager.py       # 폴더 스캔, 파일 생성/수정/삭제/이름변경
│   └── ui/
│       ├── main_window.py    # 메인 윈도우 & 분할창(PanedWindow)
│       ├── tree_panel.py     # 좌측: 폴더/파일 계층 트리뷰 & 도구모음
│       └── editor_panel.py   # 우측: 자동저장 텍스트 에디터
├── dist/
│   └── MyMemo.app            # Mac용 무설치 독립 실행 앱
├── memos/                    # 기본 메모 저장 폴더
├── main.py                   # 실행 진입점
├── MyMemo.command            # Mac용 더블클릭 런처
├── MyMemo.vbs                # Windows용 무창 더블클릭 런처
├── run.sh / run.bat          # 터미널 실행 스크립트
└── build_exe.bat             # Windows용 MyMemo.exe 빌더
```
