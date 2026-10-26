# 📝 데스크톱 메모 (Desktop Memo)

![Version](https://img.shields.io/badge/version-v1.0.12-blue.svg)
[![Changelog](https://img.shields.io/badge/changelog-CHANGELOG.md-informational.svg)](CHANGELOG.md)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)
![Dependencies](https://img.shields.io/badge/dependencies-Zero%20(Pure%20Node.js)-success.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

파이썬 환경 종속성이나 무거운 일렉트론, 검은 화면 렌더링 문제 없이 **어떤 PC(Windows / macOS)에서든 즉시 실행되는 초경량 로컬 폴더 트리형 데스크톱 메모 프로그램**입니다.  
외부 패키지 설치(`npm install`)가 전혀 필요 없는 **순정 Node.js 표준 라이브러리(Zero Dependencies)** 기반으로 제작되었습니다.

---

## ✨ 주요 기능

### 1. 📂 좌측 탐색기: 폴더 트리 & 드래그 앤 드롭 이동
- **마우스 드래그 앤 드롭 이동 (신규)**: 파일이나 폴더를 마우스로 끌어서 다른 폴더 위로 놓으면 해당 폴더로 즉시 이동됩니다. 빈 공간이나 상단 폴더명으로 드래그하면 최상위(루트) 폴더로 이동합니다.
- **기본 `.txt` 메모 전용 보기**: 기본적으로 텍스트 메모 파일과 폴더만 깔끔하게 표시되어 다른 파일이 섞여 있어도 어지럽지 않습니다.
- **파일 필터 토글 (`[📄 txt]` / `[🗂️ 전체]`)**: 상단 툴바 버튼을 눌러 언제든 엑셀(`.xlsx`), PDF, 이미지 등 모든 파일을 파일별 전용 아이콘(`📊`, `📑`, `🖼️` 등)과 함께 확인할 수 있습니다.
- **작업 공간(폴더) 자유 변경**: 상단 **`[폴더 변경]`** 버튼으로 메모를 저장할 로컬 폴더(문서, 클라우드 동기화 폴더 등)를 지정할 수 있으며, 자체 비주얼 폴더 브라우저 및 윈도우/맥 시스템 탐색기 연동을 모두 지원합니다.
- **빠른 액션**: 마우스 호버 시 새 메모(`+📝`), 새 폴더(`+📁`), 이름 변경(`✏️`), 삭제(`🗑️`) 버튼이 나타납니다.
- **실시간 검색**: 검색창에 키워드를 입력하면 일치하는 파일과 폴더만 즉시 필터링됩니다.

---

### 2. 📊 엑셀 및 외부 파일 연동 & 더블 클릭 실행
- **본문 링크 지원**: 본문에 `[[매출현황.xlsx]]` 또는 `[보고서](자료.pdf)` 형식으로 링크를 걸어둘 수 있습니다.
- **간편한 파일 드래그 본문 첨부**: 컴퓨터 파일 탐색기에서 엑셀, PDF, 이미지 등의 파일을 에디터 본문으로 드래그하면 `[[파일명.확장자]]` 링크가 자동으로 삽입됩니다.
- **더블 클릭 시 전용 프로그램 실행**: 본문에 작성된 링크를 **더블 클릭**(또는 <kbd>Ctrl</kbd>+클릭)하면:
  - 엑셀(`.xlsx`, `.xls`, `.csv`) ➔ **Microsoft Excel** 실행
  - 문서(`.pdf`, `.docx`, `.pptx`, `.hwp`, `.hwpx`) ➔ **PDF 뷰어, Word, 한글** 등 연결 프로그램 실행
  - 이미지 및 미디어(`.png`, `.jpg`, `.mp4` 등) ➔ **기본 뷰어**로 자동 실행
- 메모 폴더 내 하위 폴더 어디에 위치하든 파일명을 자동으로 탐색하여 열어주며, 컴퓨터 내 절대 경로(`C:\자료\...`) 링크도 완벽 지원합니다.

---

### 3. 📝 실시간 메모 에디터 & 스마트 저장
- **실시간 자동 저장**: 글을 작성하면 1초 유휴 시(또는 연속 타이핑 시 3초 주기) 자동으로 파일에 실시간 저장됩니다.
- **지능형 수정 감지**: 실제 파일 내용이 변경되었을 때만 탐색기에 오렌지색 점(●)과 `수정 중` 상태가 표시되며, 원래 내용으로 되돌리면 즉시 `저장됨` 상태로 복귀합니다.
- **좌우 창 크기 조절**: 가운데 스플리터를 드래그하여 탐색기와 본문 창 너비를 자유롭게 조절할 수 있습니다.
- **하단 상태 표시줄**: 글자 수, 단어 수, 현재 줄/열 번호, 인코딩(UTF-8), 최종 저장 시각을 실시간 표시합니다.

---

### 4. 🔍 단어 찾기 및 바꾸기 (Find & Replace)
- **단축키 지원**: <kbd>Ctrl</kbd>+<kbd>F</kbd> (찾기), <kbd>Ctrl</kbd>+<kbd>H</kbd> (찾기 및 바꾸기)
- 대/소문자 구분(Aa), 일치 개수 실시간 카운트(`1 / 5`, `결과 없음`), 이전(▲)/다음(▼) 일치 항목 탐색
- 현재 선택 항목 바꾸기 및 문서 전체 일괄 바꾸기 지원

---

### 5. 🔢 줄 번호 & 자동 줄바꿈 (Word Wrap)
- **하단 상태바 원클릭 토글**:
  - **`[🔢 줄 번호]`** (<kbd>Alt</kbd>+<kbd>L</kbd>): 에디터 좌측 줄 번호 표시/숨김
  - **`[↩ 자동 줄바꿈]`** (<kbd>Alt</kbd>+<kbd>Z</kbd>): 창 너비에 맞춘 줄바꿈 켜기/끄기
- 자동 줄바꿈 시에도 줄 높이에 맞춰 좌측 줄 번호 위치가 완벽하게 일치합니다.

---

### 6. 🔗 메모 간 상호 연결 & 탐색 히스토리
- **위키 링크**: 본문에 `[[메모이름]]`을 적고 더블 클릭하면 해당 메모로 즉시 이동합니다.
- **상단 [🔗 링크 삽입] 창**: 단축키 <kbd>Ctrl</kbd>+<kbd>K</kbd>로 연결할 메모나 외부 파일을 손쉽게 검색하여 삽입할 수 있습니다.
- **히스토리 뒤로가기/앞으로가기**: 웹 브라우저처럼 상단 `◀` / `▶` 버튼이나 단축키(<kbd>Alt</kbd>+<kbd>←</kbd>, <kbd>Alt</kbd>+<kbd>→</kbd>)로 이전 열람 메모로 즉시 되돌아갈 수 있습니다.

---

### 7. 🌓 다크 모드 / 라이트 모드
- 좌측 상단 `🌙` / `☀️` 버튼으로 언제든 테마를 전환할 수 있습니다.
- 운영체제 시스템 설정(다크 모드)을 기본 인식하며, 브라우저에 설정이 자동 저장됩니다.

---

## ⌨️ 키보드 단축키 모음

| 기능 | Windows 단축키 | Mac 단축키 |
| :--- | :---: | :---: |
| **단어 찾기 (Find)** | <kbd>Ctrl</kbd> + <kbd>F</kbd> | <kbd>Cmd</kbd> + <kbd>F</kbd> |
| **단어 바꾸기 (Replace)** | <kbd>Ctrl</kbd> + <kbd>H</kbd> | <kbd>Cmd</kbd> + <kbd>H</kbd> |
| **메모 즉시 저장** | <kbd>Ctrl</kbd> + <kbd>S</kbd> | <kbd>Cmd</kbd> + <kbd>S</kbd> |
| **줄 번호 켜기 / 끄기** | <kbd>Alt</kbd> + <kbd>L</kbd> | <kbd>Option</kbd> + <kbd>L</kbd> |
| **자동 줄바꿈 켜기 / 끄기** | <kbd>Alt</kbd> + <kbd>Z</kbd> | <kbd>Option</kbd> + <kbd>Z</kbd> |
| **메모 링크 삽입 창 열기** | <kbd>Ctrl</kbd> + <kbd>K</kbd> | <kbd>Cmd</kbd> + <kbd>K</kbd> |
| **새 메모 생성** | <kbd>Ctrl</kbd> + <kbd>N</kbd> | <kbd>Cmd</kbd> + <kbd>N</kbd> |
| **폴더 변경 창 열기** | <kbd>Ctrl</kbd> + <kbd>O</kbd> | <kbd>Cmd</kbd> + <kbd>O</kbd> |
| **이전 메모로 뒤로가기** | <kbd>Alt</kbd> + <kbd>←</kbd> 또는 <kbd>Ctrl</kbd> + <kbd>[</kbd> | <kbd>Option</kbd> + <kbd>←</kbd> 또는 <kbd>Cmd</kbd> + <kbd>[</kbd> |
| **다음 메모로 앞으로가기** | <kbd>Alt</kbd> + <kbd>→</kbd> 또는 <kbd>Ctrl</kbd> + <kbd>]</kbd> | <kbd>Option</kbd> + <kbd>→</kbd> 또는 <kbd>Cmd</kbd> + <kbd>]</kbd> |
| **기능 안내 / 단축키 도움말** | <kbd>F1</kbd> | <kbd>F1</kbd> |

---

## 🚀 실행 방법 (마우스 더블 클릭)

### 🪟 Windows에서 실행
1. **`DesktopMemo.exe` 더블 클릭 (가장 추천)**:
   - 전용 아이콘이 탑재된 윈도우 실행 파일입니다. 검은색 CMD 창 없이 백그라운드로 로컬 서버를 띄우고 앱 모드로 즉시 실행됩니다.
2. 또는 `DesktopMemo.vbs` 및 `DesktopMemo.bat`으로도 실행할 수 있습니다.

### 🍎 Mac에서 실행
1. **`DesktopMemo.app` 더블 클릭 (가장 추천)**:
   - 일반 데스크톱 앱처럼 독(Dock)에 등록하고 독립 창으로 실행됩니다.
2. 또는 `DesktopMemo.command` 더블 클릭으로 실행할 수 있습니다.

---

## 📂 프로젝트 파일 구조

```text
memo/
├── memos/                  # 기본 메모 저장 디렉토리 (.txt, .xlsx 등)
├── public/                 # 웹 클라이언트 프론트엔드 에셋
│   ├── index.html          # 에디터 마크업 및 모달 UI
│   ├── style.css           # 모던 테마, 반응형, 애니메이션 CSS
│   ├── app.js              # 에디터 로직, 단축키, 드래그앤드롭 핸들러
│   └── favicon.*           # 앱 아이콘 에셋 (.png, .svg, .ico)
├── server.js               # Node.js 순정 HTTP/REST API 백엔드 서버
├── DesktopMemo.exe         # Windows 네이티브 GUI 실행 파일 (아이콘 탑재)
├── DesktopMemo.vbs         # Windows 백그라운드 무창 런처
├── DesktopMemo.bat         # Windows 콘솔 런처
├── DesktopMemo.app         # macOS 데스크톱 실행 애플리케이션
├── DesktopMemo.command     # macOS 터미널 런처
├── CHANGELOG.md            # 버전별 변경 이력 및 릴리즈 노트
└── README.md               # 프로젝트 안내 문서
```

---

## 💡 특징
- **Zero npm dependencies**: `npm install`이나 `node_modules` 폴더가 전혀 필요 없으며, Node.js만 설치되어 있으면 초경량으로 즉시 작동합니다.
- **데이터 로컬 저장**: 모든 메모는 클라우드 서버가 아닌 사용자의 로컬 컴퓨터 폴더에 `.txt` 텍스트 파일로 안전하게 저장되어 데이터 유출 우려가 전혀 없습니다.
