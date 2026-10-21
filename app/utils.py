"""Utility functions for date formatting, snippets, and export."""
import os
from datetime import datetime
from typing import Optional


def format_timestamp(ts_str: Optional[str]) -> str:
    """Format an ISO-like timestamp string into user-friendly text."""
    if not ts_str:
        return ""
    try:
        # Handle formats like "YYYY-MM-DD HH:MM:SS" or ISO format
        clean_ts = ts_str.replace("T", " ")
        if "." in clean_ts:
            clean_ts = clean_ts.split(".")[0]
        dt = datetime.strptime(clean_ts, "%Y-%m-%d %H:%M:%S")
        now = datetime.now()

        if dt.date() == now.date():
            return dt.strftime("오늘 %H:%M")
        elif dt.year == now.year:
            return dt.strftime("%m월 %d일 %H:%M")
        else:
            return dt.strftime("%Y.%m.%d")
    except Exception:
        return ts_str[:16] if len(ts_str) >= 16 else ts_str


def get_snippet(content: str, max_length: int = 50) -> str:
    """Extract a single-line preview snippet from note content."""
    if not content:
        return "추가 텍스트 없음"
    # Find first non-empty line
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return "추가 텍스트 없음"
    snippet = lines[0]
    if len(snippet) > max_length:
        return snippet[:max_length] + "..."
    return snippet


def export_note_to_file(filepath: str, title: str, content: str, category_name: Optional[str] = None) -> None:
    """Export a note to Markdown or Text file."""
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        if filepath.endswith(".md"):
            f.write(f"# {title}\n\n")
            if category_name:
                f.write(f"> 카테고리: {category_name}\n\n")
            f.write(content)
        else:
            f.write(f"=== {title} ===\n")
            if category_name:
                f.write(f"카테고리: {category_name}\n")
            f.write("-" * 30 + "\n\n")
            f.write(content)
