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

## 🚀 실행 방법

### 1. 간편 실행 스크립트 (추천)
터미널에서 아래 명령어를 실행하면 가상환경 구성 및 패키지 설치 후 바로 실행됩니다:
```bash
./run.sh
```

### 2. 수동 실행
```bash
# 가상환경 활성화 (이미 생성되어 있는 경우)
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 프로그램 실행
python main.py
```

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
