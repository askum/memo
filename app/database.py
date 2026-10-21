"""SQLite database management for Desktop Memo application."""
import os
import sqlite3
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any


DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "memo.db")


class Database:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.init_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_schema(self) -> None:
        """Create tables if they don't exist and seed default category and welcome memo."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Categories table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    icon TEXT DEFAULT '📁',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Notes table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER,
                    title TEXT NOT NULL,
                    content TEXT DEFAULT '',
                    is_pinned INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
                );
            """)

            # Create default categories if none exist
            cursor.execute("SELECT COUNT(*) as count FROM categories")
            if cursor.fetchone()["count"] == 0:
                cursor.execute("INSERT INTO categories (name, icon) VALUES (?, ?)", ("업무", "💼"))
                cursor.execute("INSERT INTO categories (name, icon) VALUES (?, ?)", ("개인", "🏡"))
                cursor.execute("INSERT INTO categories (name, icon) VALUES (?, ?)", ("아이디어", "💡"))
                work_cat_id = cursor.lastrowid - 2

                # Add a welcome note
                welcome_title = "데스크톱 메모 앱에 오신 것을 환영합니다! 🎉"
                welcome_content = (
                    "이 프로그램은 파이썬과 CustomTkinter로 제작된 깔끔하고 가벼운 메모장입니다.\n\n"
                    "📌 주요 기능 안내:\n"
                    "1. 카테고리/폴더 관리:\n"
                    "   - 왼쪽 사이드바에서 새 카테고리를 추가하고 관리할 수 있습니다.\n"
                    "   - 카테고리별로 필터링하거나 전체 메모를 한눈에 볼 수 있습니다.\n\n"
                    "2. 실시간 자동 저장:\n"
                    "   - 작성 중인 메모는 내용이 변경되면 자동으로 안전하게 저장됩니다.\n\n"
                    "3. 빠른 검색:\n"
                    "   - 메모 목록 상단의 검색창에서 제목과 내용을 실시간으로 검색할 수 있습니다.\n\n"
                    "4. 파일 내보내기:\n"
                    "   - 작성한 메모를 마크다운(.md) 또는 텍스트(.txt) 파일로 손쉽게 내보낼 수 있습니다.\n\n"
                    "5. 다크 모드 / 라이트 모드:\n"
                    "   - 왼쪽 하단 설정에서 다크 모드, 라이트 모드, 시스템 모드를 자유롭게 전환하세요."
                )
                now = datetime.now().isoformat(sep=' ', timespec='seconds')
                cursor.execute("""
                    INSERT INTO notes (category_id, title, content, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (work_cat_id, welcome_title, welcome_content, now, now))
            
            conn.commit()

    # --- Category Operations ---
    def get_categories(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.name, c.icon, COUNT(n.id) as note_count
                FROM categories c
                LEFT JOIN notes n ON c.id = n.category_id
                GROUP BY c.id, c.name, c.icon
                ORDER BY c.id ASC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def add_category(self, name: str, icon: str = "📁") -> int:
        name = name.strip()
        if not name:
            raise ValueError("카테고리 이름을 입력해주세요.")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO categories (name, icon) VALUES (?, ?)", (name, icon))
            conn.commit()
            return cursor.lastrowid

    def update_category(self, category_id: int, new_name: str, new_icon: Optional[str] = None) -> None:
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("카테고리 이름을 입력해주세요.")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if new_icon:
                cursor.execute("UPDATE categories SET name = ?, icon = ? WHERE id = ?", (new_name, new_icon, category_id))
            else:
                cursor.execute("UPDATE categories SET name = ? WHERE id = ?", (new_name, category_id))
            conn.commit()

    def delete_category(self, category_id: int, delete_notes: bool = False) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if delete_notes:
                cursor.execute("DELETE FROM notes WHERE category_id = ?", (category_id,))
            else:
                cursor.execute("UPDATE notes SET category_id = NULL WHERE category_id = ?", (category_id,))
            cursor.execute("DELETE FROM categories WHERE id = ?", (category_id,))
            conn.commit()

    # --- Note Operations ---
    def get_notes(self, category_id: Optional[int] = None, search_query: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT n.id, n.category_id, n.title, n.content, n.is_pinned, n.created_at, n.updated_at,
                       c.name as category_name, c.icon as category_icon
                FROM notes n
                LEFT JOIN categories c ON n.category_id = c.id
                WHERE 1=1
            """
            params: List[Any] = []

            if category_id is not None:
                query += " AND n.category_id = ?"
                params.append(category_id)

            if search_query and search_query.strip():
                pattern = f"%{search_query.strip()}%"
                query += " AND (n.title LIKE ? OR n.content LIKE ?)"
                params.extend([pattern, pattern])

            query += " ORDER BY n.is_pinned DESC, n.updated_at DESC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_note(self, note_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT n.id, n.category_id, n.title, n.content, n.is_pinned, n.created_at, n.updated_at,
                       c.name as category_name, c.icon as category_icon
                FROM notes n
                LEFT JOIN categories c ON n.category_id = c.id
                WHERE n.id = ?
            """, (note_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_note(self, title: str = "새 메모", content: str = "", category_id: Optional[int] = None) -> int:
        title = title.strip() or "새 메모"
        now = datetime.now().isoformat(sep=' ', timespec='seconds')
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notes (category_id, title, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (category_id, title, content, now, now))
            conn.commit()
            return cursor.lastrowid

    def update_note(self, note_id: int, title: str, content: str, category_id: Optional[int] = None) -> None:
        title = title.strip() or "제목 없음"
        now = datetime.now().isoformat(sep=' ', timespec='seconds')
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE notes
                SET title = ?, content = ?, category_id = ?, updated_at = ?
                WHERE id = ?
            """, (title, content, category_id, now, note_id))
            conn.commit()

    def delete_note(self, note_id: int) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            conn.commit()

    def get_total_note_count(self) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM notes")
            return cursor.fetchone()["count"]
