"""Right panel: File editor with auto-save, status bar, and statistics."""
import os
import tkinter as tk
from tkinter import ttk
from typing import Optional
from ..file_manager import FileManager


class EditorPanel(ttk.Frame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.current_filepath: Optional[str] = None
        self._save_timer_id = None
        self._is_loading = False

        self._setup_ui()

    def _setup_ui(self):
        # 1. Top Header Toolbar
        self.header_frame = ttk.Frame(self, padding=(10, 6))
        self.header_frame.pack(fill="x")

        self.lbl_file_icon = ttk.Label(self.header_frame, text="📝", font=("System", 14))
        self.lbl_file_icon.pack(side="left", padx=(0, 4))

        self.lbl_filename = ttk.Label(
            self.header_frame,
            text="선택된 파일 없음",
            font=("System", 13, "bold")
        )
        self.lbl_filename.pack(side="left", padx=(0, 8))

        self.lbl_status = ttk.Label(
            self.header_frame,
            text="",
            font=("System", 10),
            foreground="gray"
        )
        self.lbl_status.pack(side="left")

        self.btn_save = ttk.Button(
            self.header_frame,
            text="💾 저장",
            width=7,
            command=self.save_current_file
        )
        self.btn_save.pack(side="right")

        # Separator
        sep = ttk.Separator(self, orient="horizontal")
        sep.pack(fill="x", padx=10, pady=(0, 4))

        # 2. Main Text Area Container
        self.editor_container = ttk.Frame(self)
        self.editor_container.pack(fill="both", expand=True, padx=10, pady=(2, 4))

        # Font configuration
        font_family = "Menlo" if os.name != "nt" else "Consolas"
        self.text_widget = tk.Text(
            self.editor_container,
            wrap="word",
            undo=True,
            font=(font_family, 13),
            padx=12,
            pady=12,
            relief="flat",
            highlightthickness=1,
            highlightbackground="#d1d5db",
            highlightcolor="#3b82f6"
        )
        vsb = ttk.Scrollbar(self.editor_container, orient="vertical", command=self.text_widget.yview)
        self.text_widget.configure(yscrollcommand=vsb.set)

        self.text_widget.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self.text_widget.bind("<KeyRelease>", self._on_text_modified)
        self.text_widget.bind("<<Selection>>", self._update_cursor_pos)
        self.text_widget.bind("<ButtonRelease-1>", self._update_cursor_pos)

        # 3. Bottom Status Bar
        self.status_bar = ttk.Frame(self, padding=(10, 4))
        self.status_bar.pack(fill="x", side="bottom")

        self.lbl_stats = ttk.Label(
            self.status_bar,
            text="0 글자 | 0 단어",
            font=("System", 10),
            foreground="gray"
        )
        self.lbl_stats.pack(side="left")

        self.lbl_pos = ttk.Label(
            self.status_bar,
            text="줄 1, 열 1 | UTF-8",
            font=("System", 10),
            foreground="gray"
        )
        self.lbl_pos.pack(side="right")

        # Initial Empty State
        self._set_empty_state()

    def _set_empty_state(self):
        self.current_filepath = None
        self.lbl_file_icon.configure(text="📁")
        self.lbl_filename.configure(text="파일을 선택해주세요")
        self.lbl_status.configure(text="")
        self.text_widget.delete("1.0", "end")
        self.text_widget.insert("1.0", "\n  👈 왼쪽 창에서 메모 파일을 선택하거나, [+ 📝 새 메모] 버튼을 눌러 파일을 생성하세요.\n")
        self.text_widget.configure(state="disabled")
        self.btn_save.configure(state="disabled")
        self.lbl_stats.configure(text="")
        self.lbl_pos.configure(text="")

    def open_file(self, filepath: str):
        # Save previous file if modified
        self.flush_save()

        if not os.path.exists(filepath):
            self._set_empty_state()
            return

        self._is_loading = True
        self.current_filepath = filepath
        filename = os.path.basename(filepath)

        self.lbl_file_icon.configure(text="📝")
        self.lbl_filename.configure(text=filename)
        self.lbl_status.configure(text="💾 저장됨", foreground="#16a34a")

        self.text_widget.configure(state="normal")
        self.btn_save.configure(state="normal")

        try:
            content = FileManager.read_file(filepath)
            self.text_widget.delete("1.0", "end")
            self.text_widget.insert("1.0", content)
            self.text_widget.edit_reset()
        except Exception as e:
            self.text_widget.delete("1.0", "end")
            self.text_widget.insert("1.0", f"파일을 읽는 중 오류가 발생했습니다: {str(e)}")

        self._update_stats()
        self._update_cursor_pos()
        self._is_loading = False

    def _on_text_modified(self, event=None):
        if self._is_loading or not self.current_filepath:
            return

        self.lbl_status.configure(text="✏️ 수정 중...", foreground="#d97706")
        self._update_stats()
        self._update_cursor_pos()

        # Debounce auto-save 500ms
        if self._save_timer_id:
            self.after_cancel(self._save_timer_id)
        self._save_timer_id = self.after(500, self.save_current_file)

    def save_current_file(self):
        if not self.current_filepath:
            return
        if self._save_timer_id:
            self.after_cancel(self._save_timer_id)
            self._save_timer_id = None

        content = self.text_widget.get("1.0", "end-1c")
        try:
            FileManager.write_file(self.current_filepath, content)
            self.lbl_status.configure(text="💾 저장됨", foreground="#16a34a")
        except Exception as e:
            self.lbl_status.configure(text=f"❌ 저장 실패: {str(e)}", foreground="#dc2626")

    def flush_save(self):
        """Immediately save if any changes are pending."""
        if self._save_timer_id and self.current_filepath:
            self.after_cancel(self._save_timer_id)
            self._save_timer_id = None
            self.save_current_file()

    def _update_stats(self):
        text = self.text_widget.get("1.0", "end-1c")
        chars = len(text)
        words = len(text.split())
        self.lbl_stats.configure(text=f"{chars} 글자 | {words} 단어")

    def _update_cursor_pos(self, event=None):
        try:
            index = self.text_widget.index("insert")
            line, col = index.split(".")
            self.lbl_pos.configure(text=f"줄 {line}, 열 {int(col)+1} | UTF-8")
        except Exception:
            pass
