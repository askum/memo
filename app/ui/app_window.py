"""Main Application Window for Desktop Memo."""
import sys
import customtkinter as ctk
from typing import Optional
from ..database import Database
from .sidebar import Sidebar
from .note_list import NoteListPanel
from .editor import EditorPanel


class AppWindow(ctk.CTk):
    def __init__(self, db: Database):
        super().__init__()

        self.db = db
        self.active_category_id: Optional[int] = None
        self.active_note_id: Optional[int] = None
        self.current_search_query: str = ""

        # Window settings
        self.title("데스크톱 메모 - My Memo")
        self.geometry("1050x680")
        self.minsize(800, 500)

        # Main Layout (3 Columns)
        self.grid_columnconfigure(0, weight=0)  # Sidebar
        self.grid_columnconfigure(1, weight=0)  # Note List
        self.grid_columnconfigure(2, weight=1)  # Editor
        self.grid_rowconfigure(0, weight=1)

        self._init_components()
        self._bind_shortcuts()
        self._refresh_all(select_first_note=True)

    def _init_components(self):
        # 1. Left Sidebar
        self.sidebar = Sidebar(
            self,
            on_select_category=self.handle_select_category,
            on_add_category=self.handle_add_category,
            on_edit_category=self.handle_edit_category,
            on_delete_category=self.handle_delete_category,
            fg_color=("gray95", "#18181b")
        )
        self.sidebar.grid(row=0, column=0, sticky="nsew")

        # Vertical Divider 1
        sep1 = ctk.CTkFrame(self, width=1, fg_color=("gray85", "#27272a"), corner_radius=0)
        sep1.grid(row=0, column=0, sticky="nse")

        # 2. Middle Note List Panel
        self.note_list = NoteListPanel(
            self,
            on_select_note=self.handle_select_note,
            on_create_note=self.handle_create_note,
            on_search=self.handle_search,
            fg_color=("gray98", "#1e1e24")
        )
        self.note_list.grid(row=0, column=1, sticky="nsew")

        # Vertical Divider 2
        sep2 = ctk.CTkFrame(self, width=1, fg_color=("gray85", "#27272a"), corner_radius=0)
        sep2.grid(row=0, column=1, sticky="nse")

        # 3. Right Editor Panel
        self.editor = EditorPanel(
            self,
            on_save_note=self.handle_save_note,
            on_delete_note=self.handle_delete_note,
            fg_color=("white", "#121214")
        )
        self.editor.grid(row=0, column=2, sticky="nsew")

    def _bind_shortcuts(self):
        is_mac = sys.platform == "darwin"
        modifier = "Command" if is_mac else "Control"

        # Cmd/Ctrl + N: New note
        self.bind(f"<{modifier}-n>", lambda e: self.handle_create_note())
        self.bind(f"<{modifier}-N>", lambda e: self.handle_create_note())

        # Cmd/Ctrl + F: Focus search
        self.bind(f"<{modifier}-f>", self._focus_search)
        self.bind(f"<{modifier}-F>", self._focus_search)

        # Cmd/Ctrl + S: Flush save
        self.bind(f"<{modifier}-s>", lambda e: self.editor.flush_save())
        self.bind(f"<{modifier}-S>", lambda e: self.editor.flush_save())

    def _focus_search(self, event=None):
        self.note_list.search_entry.focus_set()
        self.note_list.search_entry.select_range(0, "end")
        return "break"

    def _refresh_all(self, select_first_note: bool = False):
        categories = self.db.get_categories()
        total_count = self.db.get_total_note_count()

        # Update sidebar
        self.sidebar.update_categories(categories, total_count)
        # Update editor category dropdown
        self.editor.set_categories(categories)

        # Update note list
        notes = self.db.get_notes(self.active_category_id, self.current_search_query)

        if select_first_note:
            if notes:
                self.active_note_id = notes[0]["id"]
            else:
                self.active_note_id = None

        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

        # Load active note in editor
        if self.active_note_id is not None:
            note = self.db.get_note(self.active_note_id)
            self.editor.load_note(note)
        else:
            self.editor.load_note(None)

    # --- Event Handlers ---
    def handle_select_category(self, category_id: Optional[int]):
        self.editor.flush_save()
        self.active_category_id = category_id
        # Reload notes for this category and select the first one
        notes = self.db.get_notes(self.active_category_id, self.current_search_query)
        self.active_note_id = notes[0]["id"] if notes else None
        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

        if self.active_note_id is not None:
            note = self.db.get_note(self.active_note_id)
            self.editor.load_note(note)
        else:
            self.editor.load_note(None)

    def handle_add_category(self, name: str, icon: str):
        try:
            new_id = self.db.add_category(name, icon)
            self._refresh_all(select_first_note=False)
            self.handle_select_category(new_id)
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("오류", f"카테고리 추가 실패: {str(e)}")

    def handle_edit_category(self, category_id: int, new_name: str, new_icon: str):
        try:
            self.db.update_category(category_id, new_name, new_icon)
            self._refresh_all(select_first_note=False)
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("오류", f"카테고리 수정 실패: {str(e)}")

    def handle_delete_category(self, category_id: int):
        try:
            self.db.delete_category(category_id)
            if self.active_category_id == category_id:
                self.active_category_id = None
            self._refresh_all(select_first_note=True)
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("오류", f"카테고리 삭제 실패: {str(e)}")

    def handle_select_note(self, note_id: int):
        if self.active_note_id == note_id:
            return
        self.editor.flush_save()
        self.active_note_id = note_id
        note = self.db.get_note(note_id)
        self.editor.load_note(note)

        # Refresh list highlighting
        notes = self.db.get_notes(self.active_category_id, self.current_search_query)
        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

    def handle_create_note(self):
        self.editor.flush_save()
        new_id = self.db.create_note(
            title="새 메모",
            content="",
            category_id=self.active_category_id
        )
        self.active_note_id = new_id

        # Refresh notes and sidebar counts
        categories = self.db.get_categories()
        total_count = self.db.get_total_note_count()
        self.sidebar.update_categories(categories, total_count)

        notes = self.db.get_notes(self.active_category_id, self.current_search_query)
        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

        note = self.db.get_note(new_id)
        self.editor.load_note(note)
        self.editor.title_entry.focus_set()
        self.editor.title_entry.select_range(0, "end")

    def handle_search(self, query: str):
        self.current_search_query = query
        notes = self.db.get_notes(self.active_category_id, self.current_search_query)

        # If current active note is not in search results, select the first result
        note_ids = [n["id"] for n in notes]
        if self.active_note_id not in note_ids:
            self.active_note_id = note_ids[0] if note_ids else None
            note = self.db.get_note(self.active_note_id) if self.active_note_id else None
            self.editor.load_note(note)

        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

    def handle_save_note(self, note_id: int, title: str, content: str, category_id: Optional[int]):
        self.db.update_note(note_id, title, content, category_id)

        # Refresh note list cards & sidebar category count badges
        categories = self.db.get_categories()
        total_count = self.db.get_total_note_count()
        self.sidebar.update_categories(categories, total_count)

        notes = self.db.get_notes(self.active_category_id, self.current_search_query)
        self.note_list.update_notes(notes, selected_note_id=self.active_note_id)

    def handle_delete_note(self, note_id: int):
        self.db.delete_note(note_id)
        self.active_note_id = None

        # Refresh all and pick first note if exists
        self._refresh_all(select_first_note=True)
