"""Main Application Window for Desktop Memo."""
import sys
import tkinter as tk
from tkinter import ttk
from ..config import Config
from .tree_panel import TreePanel
from .editor_panel import EditorPanel


class MainWindow(tk.Tk):
    def __init__(self):
        super().__init__()

        self.config = Config()

        # Window settings
        self.title("📝 데스크톱 메모 - My Memo")
        self.geometry("1050x680")
        self.minsize(750, 450)

        # Apply system ttk style
        self._setup_style()

        # Setup PanedWindow Layout (Tree on Left, Editor on Right)
        self._setup_layout()

        # Setup Menus & Keyboard Shortcuts
        self._setup_menus()
        self._setup_shortcuts()

        # Save on exit protocol
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Restore last opened file or first file
        self._restore_initial_state()

    def _setup_style(self):
        style = ttk.Style(self)
        available_themes = style.theme_names()
        if sys.platform == "darwin" and "aqua" in available_themes:
            style.theme_use("aqua")
        elif "clam" in available_themes:
            style.theme_use("clam")

    def _setup_layout(self):
        self.paned = ttk.PanedWindow(self, orient="horizontal")
        self.paned.pack(fill="both", expand=True)

        root_folder = self.config.get_root_folder()

        # Left: Tree Panel
        self.tree_panel = TreePanel(
            self.paned,
            initial_root_dir=root_folder,
            on_file_selected=self._on_file_selected,
            on_root_changed=self._on_root_changed,
            width=280
        )
        self.paned.add(self.tree_panel, weight=1)

        # Right: Editor Panel
        self.editor_panel = EditorPanel(self.paned)
        self.paned.add(self.editor_panel, weight=4)

    def _setup_menus(self):
        menubar = tk.Menu(self)

        # File Menu
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="📂 폴더 열기...", accelerator="Cmd+O" if sys.platform == "darwin" else "Ctrl+O", command=self.tree_panel._choose_folder)
        file_menu.add_command(label="📝 새 메모 만들기...", accelerator="Cmd+N" if sys.platform == "darwin" else "Ctrl+N", command=self.tree_panel._on_click_new_file)
        file_menu.add_command(label="📁 새 폴더 만들기...", command=self.tree_panel._on_click_new_folder)
        file_menu.add_separator()
        file_menu.add_command(label="💾 저장", accelerator="Cmd+S" if sys.platform == "darwin" else "Ctrl+S", command=self.editor_panel.save_current_file)
        file_menu.add_separator()
        file_menu.add_command(label="종료", accelerator="Cmd+Q" if sys.platform == "darwin" else "Ctrl+Q", command=self._on_close)
        menubar.add_cascade(label="파일", menu=file_menu)

        # Edit Menu
        edit_menu = tk.Menu(menubar, tearoff=0)
        edit_menu.add_command(label="실행 취소 (Undo)", command=lambda: self.editor_panel.text_widget.event_generate("<<Undo>>"))
        edit_menu.add_command(label="다시 실행 (Redo)", command=lambda: self.editor_panel.text_widget.event_generate("<<Redo>>"))
        edit_menu.add_separator()
        edit_menu.add_command(label="잘라내기", command=lambda: self.editor_panel.text_widget.event_generate("<<Cut>>"))
        edit_menu.add_command(label="복사", command=lambda: self.editor_panel.text_widget.event_generate("<<Copy>>"))
        edit_menu.add_command(label="붙여넣기", command=lambda: self.editor_panel.text_widget.event_generate("<<Paste>>"))
        edit_menu.add_command(label="모두 선택", command=lambda: self.editor_panel.text_widget.tag_add("sel", "1.0", "end"))
        menubar.add_cascade(label="편집", menu=edit_menu)

        # View Menu
        view_menu = tk.Menu(menubar, tearoff=0)
        view_menu.add_command(label="새로고침", accelerator="F5", command=self.tree_panel.refresh)
        menubar.add_cascade(label="보기", menu=view_menu)

        self.config_menu = menubar
        self.configure(menu=menubar)

    def _setup_shortcuts(self):
        is_mac = sys.platform == "darwin"
        mod = "Command" if is_mac else "Control"

        self.bind(f"<{mod}-s>", lambda e: self.editor_panel.save_current_file())
        self.bind(f"<{mod}-S>", lambda e: self.editor_panel.save_current_file())

        self.bind(f"<{mod}-n>", lambda e: self.tree_panel._on_click_new_file())
        self.bind(f"<{mod}-N>", lambda e: self.tree_panel._on_click_new_file())

        self.bind(f"<{mod}-o>", lambda e: self.tree_panel._choose_folder())
        self.bind(f"<{mod}-O>", lambda e: self.tree_panel._choose_folder())

        self.bind(f"<{mod}-q>", lambda e: self._on_close())
        self.bind(f"<{mod}-Q>", lambda e: self._on_close())

        self.bind("<F5>", lambda e: self.tree_panel.refresh())

    def _on_file_selected(self, filepath: str):
        self.editor_panel.open_file(filepath)
        self.config.set_last_opened_file(filepath)

    def _on_root_changed(self, new_root: str):
        self.config.set_root_folder(new_root)

    def _restore_initial_state(self):
        last_file = self.config.get_last_opened_file()
        if last_file:
            self.tree_panel._select_and_open_path(last_file)

    def _on_close(self):
        self.editor_panel.flush_save()
        self.destroy()
