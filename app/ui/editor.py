"""Right panel: Note editor with auto-save, category selection, and export."""
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
from typing import Callable, Optional, Dict, Any, List
from ..utils import format_timestamp, export_note_to_file
from .dialogs import ConfirmDialog


class EditorPanel(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_save_note: Callable[[int, str, str, Optional[int]], None],
        on_delete_note: Callable[[int], None],
        **kwargs
    ):
        super().__init__(master, corner_radius=0, **kwargs)
        self.on_save_note = on_save_note
        self.on_delete_note = on_delete_note

        self.current_note: Optional[Dict[str, Any]] = None
        self.categories: List[Dict[str, Any]] = []
        self._save_after_id = None
        self._is_loading = False

        self._setup_ui()

    def _setup_ui(self):
        # Empty placeholder state container
        self.empty_container = ctk.CTkFrame(self, fg_color="transparent")
        lbl_empty = ctk.CTkLabel(
            self.empty_container,
            text="선택된 메모가 없습니다.\n목록에서 메모를 선택하거나 새로 생성하세요.",
            font=ctk.CTkFont(size=14),
            text_color=("gray50", "gray60"),
            justify="center"
        )
        lbl_empty.pack(expand=True)

        # Editor content container
        self.content_container = ctk.CTkFrame(self, fg_color="transparent")

        # Top Toolbar
        toolbar = ctk.CTkFrame(self.content_container, height=44, fg_color="transparent")
        toolbar.pack(fill="x", padx=20, pady=(14, 8))

        # Category Selector
        lbl_cat = ctk.CTkLabel(toolbar, text="폴더:", font=ctk.CTkFont(size=12), text_color=("gray50", "gray60"))
        lbl_cat.pack(side="left", padx=(0, 6))

        self.category_var = ctk.StringVar(value="미분류")
        self.category_menu = ctk.CTkOptionMenu(
            toolbar,
            variable=self.category_var,
            values=["미분류"],
            command=self._on_category_changed,
            width=130,
            height=30,
            font=ctk.CTkFont(size=12)
        )
        self.category_menu.pack(side="left")

        # Save status indicator
        self.lbl_save_status = ctk.CTkLabel(
            toolbar,
            text="💾 저장됨",
            font=ctk.CTkFont(size=11),
            text_color=("gray50", "gray55")
        )
        self.lbl_save_status.pack(side="left", padx=(14, 0))

        # Right action buttons: Delete, Export
        btn_delete = ctk.CTkButton(
            toolbar,
            text="🗑 삭제",
            width=64,
            height=30,
            fg_color="transparent",
            hover_color=("#FEE2E2", "#7F1D1D"),
            text_color=("#DC2626", "#F87171"),
            command=self._confirm_delete
        )
        btn_delete.pack(side="right", padx=(6, 0))

        btn_export = ctk.CTkButton(
            toolbar,
            text="📤 내보내기",
            width=76,
            height=30,
            fg_color=("gray85", "#2B2B2B"),
            hover_color=("gray75", "#383838"),
            text_color=("black", "white"),
            command=self._export_note
        )
        btn_export.pack(side="right")

        # Divider
        sep = ctk.CTkFrame(self.content_container, height=1, fg_color=("gray85", "gray25"))
        sep.pack(fill="x", padx=20, pady=(4, 12))

        # Note Title Entry
        self.title_entry = ctk.CTkEntry(
            self.content_container,
            placeholder_text="메모 제목을 입력하세요",
            font=ctk.CTkFont(size=20, weight="bold"),
            height=42,
            border_width=0,
            fg_color="transparent"
        )
        self.title_entry.pack(fill="x", padx=20, pady=(0, 8))
        self.title_entry.bind("<KeyRelease>", self._on_text_modified)

        # Note Content Textbox
        self.content_box = ctk.CTkTextbox(
            self.content_container,
            font=ctk.CTkFont(size=14),
            wrap="word",
            border_width=0,
            fg_color="transparent"
        )
        self.content_box.pack(fill="both", expand=True, padx=20, pady=(0, 6))
        self.content_box.bind("<KeyRelease>", self._on_text_modified)

        # Bottom Status Bar
        self.status_bar = ctk.CTkFrame(self.content_container, height=28, fg_color="transparent")
        self.status_bar.pack(fill="x", padx=20, pady=(0, 10))

        self.lbl_stats = ctk.CTkLabel(
            self.status_bar,
            text="0 글자 | 0 단어",
            font=ctk.CTkFont(size=11),
            text_color=("gray50", "gray60")
        )
        self.lbl_stats.pack(side="left")

        self.lbl_updated_at = ctk.CTkLabel(
            self.status_bar,
            text="",
            font=ctk.CTkFont(size=11),
            text_color=("gray50", "gray60")
        )
        self.lbl_updated_at.pack(side="right")

        # Show empty state by default
        self.empty_container.pack(fill="both", expand=True)

    def set_categories(self, categories: List[Dict[str, Any]]):
        self.categories = categories
        options = ["미분류"] + [f"{c.get('icon', '📁')} {c['name']}" for c in categories]
        self.category_menu.configure(values=options)

    def load_note(self, note: Optional[Dict[str, Any]]):
        # Save any previous pending edits first
        self.flush_save()

        self._is_loading = True
        self.current_note = note

        if not note:
            self.content_container.pack_forget()
            self.empty_container.pack(fill="both", expand=True)
            self._is_loading = False
            return

        self.empty_container.pack_forget()
        self.content_container.pack(fill="both", expand=True)

        # Set Title
        self.title_entry.delete(0, "end")
        self.title_entry.insert(0, note.get("title", ""))

        # Set Content
        self.content_box.delete("1.0", "end")
        self.content_box.insert("1.0", note.get("content", ""))

        # Set Category Menu
        cat_id = note.get("category_id")
        matched_str = "미분류"
        for c in self.categories:
            if c["id"] == cat_id:
                matched_str = f"{c.get('icon', '📁')} {c['name']}"
                break
        self.category_var.set(matched_str)

        # Update metadata stats
        self._update_stats()
        self.lbl_updated_at.configure(text=f"마지막 수정: {format_timestamp(note.get('updated_at'))}")
        self.lbl_save_status.configure(text="💾 저장됨", text_color=("gray50", "gray55"))

        self._is_loading = False

    def _on_text_modified(self, event=None):
        if self._is_loading or not self.current_note:
            return

        self.lbl_save_status.configure(text="✏️ 수정 중...", text_color=("#D97706", "#F59E0B"))
        self._update_stats()

        if self._save_after_id:
            self.after_cancel(self._save_after_id)
        # Auto-save debounced after 500ms
        self._save_after_id = self.after(500, self._do_save)

    def _on_category_changed(self, selection: str):
        if self._is_loading or not self.current_note:
            return
        self._do_save()

    def _resolve_selected_category_id(self) -> Optional[int]:
        selected_text = self.category_var.get()
        if selected_text == "미분류":
            return None
        for c in self.categories:
            if f"{c.get('icon', '📁')} {c['name']}" == selected_text:
                return c["id"]
        return None

    def _update_stats(self):
        text = self.content_box.get("1.0", "end-1c")
        char_count = len(text)
        word_count = len(text.split())
        self.lbl_stats.configure(text=f"{char_count} 글자 | {word_count} 단어")

    def _do_save(self):
        if not self.current_note:
            return
        note_id = self.current_note["id"]
        title = self.title_entry.get().strip() or "새 메모"
        content = self.content_box.get("1.0", "end-1c")
        cat_id = self._resolve_selected_category_id()

        self.on_save_note(note_id, title, content, cat_id)
        self.lbl_save_status.configure(text="💾 저장됨", text_color=("gray50", "gray55"))
        self._save_after_id = None

    def flush_save(self):
        """Force immediate save if any changes are pending."""
        if self._save_after_id:
            self.after_cancel(self._save_after_id)
            self._do_save()

    def _confirm_delete(self):
        if not self.current_note:
            return
        note_id = self.current_note["id"]
        title = self.current_note.get("title") or "이 메모"

        ConfirmDialog(
            self.winfo_toplevel(),
            title="메모 삭제 확인",
            message=f"'{title}' 메모를 정말 삭제하시겠습니까?",
            on_confirm=lambda: self.on_delete_note(note_id)
        )

    def _export_note(self):
        if not self.current_note:
            return
        title = self.title_entry.get().strip() or "memo"
        content = self.content_box.get("1.0", "end-1c")
        cat_name = self.category_var.get()

        filepath = filedialog.asksaveasfilename(
            parent=self.winfo_toplevel(),
            defaultextension=".md",
            initialfile=f"{title}.md",
            filetypes=[("Markdown 파일", "*.md"), ("텍스트 파일", "*.txt"), ("모든 파일", "*.*")]
        )
        if filepath:
            try:
                export_note_to_file(filepath, title, content, cat_name if cat_name != "미분류" else None)
                messagebox.showinfo("내보내기 완료", f"파일이 성공적으로 저장되었습니다:\n{filepath}")
            except Exception as e:
                messagebox.showerror("내보내기 실패", f"파일 저장 중 오류가 발생했습니다:\n{str(e)}")
