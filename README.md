# 📝 데스크톱 메모 (Desktop Memo)

Python과 **CustomTkinter**를 기반으로 제작된 가볍고 세련된 3분할(Apple Notes 스타일) 데스크톱 메모 프로그램입니다.

---

## ✨ 주요 기능

1. **📁 카테고리 / 폴더 관리**
   - 왼쪽 사이드바에서 새 카테고리/폴더 추가 (`+` 버튼)
   - 카테고리 이름 및 아이콘(💼, 🏡, 💡, 📚 등) 수정 및 삭제
   - '전체 메모' 보기 및 카테고리별 실시간 필터링

2. **⚡ 실시간 자동 저장**
   - 메모 내용이나 제목 수정 시 500ms 후 자동으로 안전하게 로컬 SQLite DB에 저장
   - 우측 상단 상태 표시기를 통해 저장 상태 즉시 확인 ("💾 저장됨" / "✏️ 수정 중...")

3. **🔍 빠른 실시간 검색**
   - 메모 제목과 본문 내용을 타이핑 즉시 실시간 검색

4. **📤 Markdown / Text 파일 내보내기**
   - 작성한 메모를 `.md` (마크다운) 또는 `.txt` 텍스트 파일로 쉽게 내보내기 지원

5. **🎨 다크 모드 / 라이트 모드 지원**
   - macOS / Windows의 시스템 테마를 자동 감지하며, 사이드바 하단에서 언제든지 Light / Dark / System 모드로 변경 가능

6. **⌨️ 편리한 단축키**
   - `Cmd + N` (Windows: `Ctrl + N`): 새 메모 생성
   - `Cmd + F` (Windows: `Ctrl + F`): 검색창으로 포커스
   - `Cmd + S` (Windows: `Ctrl + S`): 즉시 저장

---

## 🚀 파일 더블 클릭으로 바로 실행하기 (터미널/쉘 불필요)

터미널이나 명령어를 직접 입력할 필요 없이 **마우스 더블 클릭**만으로 바로 실행할 수 있습니다:

### 🍎 Mac에서 바로 실행
1. **[`dist/MyMemo.app`](file:///Users/askum/workspace_gemini/memo/dist/MyMemo.app) 더블 클릭** (가장 추천)
   - 맥 전용 정식 앱 파일입니다. 데스크톱이나 `/Applications`(응용 프로그램) 폴더로 옮겨 두고 일반 Mac 앱처럼 실행할 수 있습니다.
2. **[`MyMemo.command`](file:///Users/askum/workspace_gemini/memo/MyMemo.command) 더블 클릭**
   - 파인더(Finder)에서 바로 더블 클릭하여 실행할 수 있는 실행 파일입니다.

---

### 🪟 Windows에서 바로 실행
1. **[`MyMemo.vbs`](file:///Users/askum/workspace_gemini/memo/MyMemo.vbs) 더블 클릭** (추천)
   - 검은색 CMD 창 없이 바로 깔끔하게 메모 앱 창만 뜹니다.
2. **[`run.bat`](file:///Users/askum/workspace_gemini/memo/run.bat) 더블 클릭**
   - 가상환경 및 패키지가 없을 때 자동으로 세팅해주며 실행됩니다.
3. **단독 실행 파일 (`MyMemo.exe`) 만들기**
   - [`build_exe.bat`](file:///Users/askum/workspace_gemini/memo/build_exe.bat)을 더블 클릭하면 `dist\MyMemo.exe`가 생성됩니다.
   - 이 `.exe` 파일은 파이썬이 설치되지 않은 다른 윈도우 컴퓨터에 보내서 바로 실행할 수 있습니다.

---

## 📂 프로젝트 구조

```
memo/
├── app/
│   ├── ui/
│   │   ├── app_window.py     # 메인 윈도우 (3-Column 레이아웃 조율)
│   │   ├── sidebar.py        # 좌측: 카테고리/폴더 목록 및 테마 전환
│   │   ├── note_list.py      # 중앙: 검색창 및 메모 리스트 카드
│   │   ├── editor.py         # 우측: 메모 제목, 본문 에디터, 내보내기/삭제
│   │   └── dialogs.py        # 카테고리 추가/수정 모달, 삭제 확인 팝업
│   ├── database.py           # SQLite3 데이터베이스 관리 및 CRUD
│   └── utils.py              # 타임스탬프, 요약문 추출, 파일 내보내기 유틸
├── tests/
│   └── test_memo.py          # 기능 및 데이터베이스 단위 테스트
├── data/
│   └── memo.db               # 로컬 SQLite 데이터베이스 (자동 생성)
├── main.py                   # 애플리케이션 진입점
├── requirements.txt          # 필요 패키지 목록
└── run.sh                    # 원클릭 실행 스크립트
```

---

## 🧪 테스트 실행
```bash
.venv/bin/python3 -m unittest discover tests
```
