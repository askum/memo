"""Configuration manager for Memo application."""
import os
import json
from typing import Any, Dict


CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
DEFAULT_MEMO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "memos")


class Config:
    def __init__(self):
        os.makedirs(CONFIG_DIR, exist_ok=True)
        os.makedirs(DEFAULT_MEMO_DIR, exist_ok=True)
        self.data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "root_folder": DEFAULT_MEMO_DIR,
            "last_opened_file": "",
            "font_size": 14
        }

    def save(self):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_root_folder(self) -> str:
        folder = self.data.get("root_folder") or DEFAULT_MEMO_DIR
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        return os.path.abspath(folder)

    def set_root_folder(self, folder: str):
        self.data["root_folder"] = os.path.abspath(folder)
        self.save()

    def get_last_opened_file(self) -> str:
        return self.data.get("last_opened_file", "")

    def set_last_opened_file(self, filepath: str):
        self.data["last_opened_file"] = filepath
        self.save()
