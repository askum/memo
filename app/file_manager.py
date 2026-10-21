"""File and folder operations for Memo application."""
import os
import shutil
from typing import List, Dict, Any, Tuple


class FileManager:
    SUPPORTED_EXTENSIONS = {".md", ".txt", ".markdown", ".json", ".csv", ".log", ""}

    @classmethod
    def ensure_initial_seed(cls, root_dir: str):
        """Create sample folders and a welcome memo if the root directory is empty."""
        if not os.path.exists(root_dir):
            os.makedirs(root_dir, exist_ok=True)

        items = [i for i in os.listdir(root_dir) if not i.startswith(".")]
        if not items:
            # Create sample subfolders
            work_dir = os.path.join(root_dir, "업무")
            personal_dir = os.path.join(root_dir, "개인")
            idea_dir = os.path.join(root_dir, "아이디어")
            os.makedirs(work_dir, exist_ok=True)
            os.makedirs(personal_dir, exist_ok=True)
            os.makedirs(idea_dir, exist_ok=True)

            # Create welcome note
            welcome_path = os.path.join(root_dir, "환영합니다.md")
            welcome_text = (
                "# 📝 폴더형 데스크톱 메모장에 오신 것을 환영합니다!\n\n"
                "왼쪽 창에서 폴더를 지정하고, 원하는 위치에 파일이나 새 폴더를 바로 만들어보세요.\n\n"
                "### 📌 주요 사용법:\n"
                "1. **폴더 선택**: 좌측 상단의 [📂 폴더 변경] 버튼으로 원하는 메모 저장 위치를 지정할 수 있습니다.\n"
                "2. **새 메모 생성**: 상단 `[+ 📝 새 메모]` 버튼을 누르거나 폴더에서 우클릭하여 새 마크다운(.md) 또는 텍스트(.txt) 파일을 생성합니다.\n"
                "3. **새 폴더 생성**: 상단 `[+ 📁 새 폴더]` 버튼으로 하위 폴더를 자유롭게 만듭니다.\n"
                "4. **자동 저장**: 우측 창에서 메모를 입력하면 자동으로 실시간 저장됩니다. (`Cmd+S` 또는 `Ctrl+S` 수동 저장도 가능)\n"
                "5. **우클릭 메뉴**: 폴더나 파일을 우클릭하여 이름 변경, 삭제, 파인더/탐색기 열기를 사용할 수 있습니다.\n"
            )
            cls.write_file(welcome_path, welcome_text)

    @classmethod
    def get_directory_tree(cls, root_path: str) -> List[Dict[str, Any]]:
        """Scan directory and return hierarchical structure of folders and files."""
        if not os.path.exists(root_path) or not os.path.isdir(root_path):
            return []

        result = []
        try:
            entries = sorted(os.listdir(root_path), key=lambda x: (not os.path.isdir(os.path.join(root_path, x)), x.lower()))
            for entry in entries:
                if entry.startswith(".") or entry == "__pycache__":
                    continue
                full_path = os.path.join(root_path, entry)
                is_dir = os.path.isdir(full_path)
                
                ext = os.path.splitext(entry)[1].lower()
                if not is_dir and ext not in cls.SUPPORTED_EXTENSIONS:
                    continue

                item = {
                    "name": entry,
                    "path": full_path,
                    "is_dir": is_dir,
                    "children": cls.get_directory_tree(full_path) if is_dir else []
                }
                result.append(item)
        except PermissionError:
            pass
        return result

    @classmethod
    def read_file(cls, filepath: str) -> str:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    @classmethod
    def write_file(cls, filepath: str, content: str) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

    @classmethod
    def create_file(cls, parent_dir: str, filename: str) -> str:
        filename = filename.strip()
        if not filename:
            raise ValueError("파일 이름을 입력해주세요.")
        if not (filename.endswith(".md") or filename.endswith(".txt")):
            filename += ".md"

        filepath = os.path.join(parent_dir, filename)
        if os.path.exists(filepath):
            raise FileExistsError(f"'{filename}' 파일이 이미 존재합니다.")

        cls.write_file(filepath, f"# {os.path.splitext(filename)[0]}\n\n")
        return filepath

    @classmethod
    def create_folder(cls, parent_dir: str, foldername: str) -> str:
        foldername = foldername.strip()
        if not foldername:
            raise ValueError("폴더 이름을 입력해주세요.")
        folderpath = os.path.join(parent_dir, foldername)
        if os.path.exists(folderpath):
            raise FileExistsError(f"'{foldername}' 폴더가 이미 존재합니다.")
        os.makedirs(folderpath, exist_ok=True)
        return folderpath

    @classmethod
    def rename(cls, old_path: str, new_name: str) -> str:
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("새 이름을 입력해주세요.")
        parent = os.path.dirname(old_path)
        new_path = os.path.join(parent, new_name)
        if os.path.exists(new_path):
            raise FileExistsError(f"'{new_name}'이(가) 이미 존재합니다.")
        os.rename(old_path, new_path)
        return new_path

    @classmethod
    def delete(cls, target_path: str) -> None:
        if not os.path.exists(target_path):
            return
        if os.path.isdir(target_path):
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
