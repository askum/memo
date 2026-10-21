"""Tree view panel for folder and file management."""
import os
import sys
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog
from typing import Callable, Optional, Dict, Any, List
from ..file_manager import FileManager


class TreePanel(ttk.Frame):
    def __init__(
        self,
        master,
        initial_root_dir: str,
        on_file_selected: Callable[[str], None],
        on_root_changed: Callable[[str], None],
        **kwargs
    ):
        super().__init__(master, **kwargs)
        self.root_dir = initial_root_dir
        self.on_file_selected = on_file_selected
        self.on_root_changed = on_root_changed

        self.item_paths: Dict[str, str] = {}  # tree_item_id -> full_path
        self._setup_ui()
        self.refresh()

    def _setup_ui(self):
        # 1. Top Folder Selection Row
        folder_frame = ttk.LabelFrame(self, text="작업 폴더", padding=(6, 4))
        folder_frame.pack(fill="x", padx=6, pady=(6, 4))

        self.lbl_current_folder = ttk.Label(
            folder_frame,
            text=self._format_folder_display(self.root_dir),
            font=("System", 11, "bold"),
            anchor="w"
        )
        self.lbl_current_folder.pack(side="left", fill="x", expand=True, padx=(4, 4))

        btn_browse = ttk.Button(
            folder_frame,
            text="폴더 변경...",
            width=10,
            command=self._choose_folder
        )
        btn_browse.pack(side="right")

        # 2. Action Toolbar Row
        toolbar = ttk.Frame(self, padding=(6, 2))
        toolbar.pack(fill="x")

        btn_new_file = ttk.Button(
            toolbar,
            text="+ 📝 새 메모",
            command=self._on_click_new_file
        )
        btn_new_file.pack(side="left", fill="x", expand=True, padx=(0, 2))

        btn_new_folder = ttk.Button(
            toolbar,
            text="+ 📁 새 폴더",
            command=self._on_click_new_folder
        )
        btn_new_folder.pack(side="left", fill="x", expand=True, padx=(2, 2))

        btn_refresh = ttk.Button(
            toolbar,
            text="🔄",
            width=3,
            command=self.refresh
        )
        btn_refresh.pack(side="right", padx=(2, 0))

        # 3. Treeview with Scrollbars
        tree_container = ttk.Frame(self)
        tree_container.pack(fill="both", expand=True, padx=6, pady=(4, 6))

        self.tree = ttk.Treeview(tree_container, selectmode="browse", show="tree")
        vsb = ttk.Scrollbar(tree_container, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(tree_container, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")

        tree_container.grid_rowconfigure(0, weight=1)
        tree_container.grid_columnconfigure(0, weight=1)

        # Bindings
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)
        self.tree.bind("<Button-2>", self._show_context_menu)  # macOS right-click
        self.tree.bind("<Button-3>", self._show_context_menu)  # Windows right-click

        # Context Menu
        self.context_menu = tk.Menu(self, tearoff=0)
        self.context_menu.add_command(label="📝 새 메모 만들기...", command=self._on_click_new_file)
        self.context_menu.add_command(label="📁 새 폴더 만들기...", command=self._on_click_new_folder)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="✏️ 이름 변경...", command=self._on_click_rename)
        self.context_menu.add_command(label="🗑️ 삭제...", command=self._on_click_delete)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="📂 파인더/탐색기에서 열기", command=self._on_open_in_finder)

    def _format_folder_display(self, path: str) -> str:
        basename = os.path.basename(path) or path
        return f"📁 {basename}"

    def set_root_dir(self, new_dir: str):
        if not os.path.exists(new_dir):
            os.makedirs(new_dir, exist_ok=True)
        self.root_dir = os.path.abspath(new_dir)
        self.lbl_current_folder.configure(text=self._format_folder_display(self.root_dir))
        self.refresh()
        self.on_root_changed(self.root_dir)

    def _choose_folder(self):
        chosen = filedialog.askdirectory(
            parent=self.winfo_toplevel(),
            title="메모를 저장할 폴더를 선택하세요",
            initialdir=self.root_dir
        )
        if chosen:
            self.set_root_dir(chosen)

    def refresh(self):
        """Re-scan folder structure and populate Treeview."""
        # Clear items
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.item_paths.clear()

        # Seed sample files if folder is empty
        FileManager.ensure_initial_seed(self.root_dir)

        tree_data = FileManager.get_directory_tree(self.root_dir)
        self._populate_tree("", tree_data)

    def _populate_tree(self, parent_node: str, items: List[Dict[str, Any]]):
        for item in items:
            name = item["name"]
            path = item["path"]
            is_dir = item["is_dir"]

            icon = "📁 " if is_dir else "📝 "
            display_text = f"{icon}{name}"

            node_id = self.tree.insert(parent_node, "end", text=display_text, open=True)
            self.item_paths[node_id] = path

            if is_dir and item.get("children"):
                self._populate_tree(node_id, item["children"])

    def get_selected_path(self) -> Optional[str]:
        selected = self.tree.selection()
        if not selected:
            return None
        return self.item_paths.get(selected[0])

    def _on_tree_select(self, event=None):
        path = self.get_selected_path()
        if path and os.path.isfile(path):
            self.on_file_selected(path)

    def _on_tree_double_click(self, event=None):
        path = self.get_selected_path()
        if path and os.path.isfile(path):
            self.on_file_selected(path)

    def _show_context_menu(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            self.tree.selection_set(item)
        try:
            self.context_menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.context_menu.grab_release()

    def _resolve_target_dir(self) -> str:
        selected_path = self.get_selected_path()
        if selected_path:
            if os.path.isdir(selected_path):
                return selected_path
            else:
                return os.path.dirname(selected_path)
        return self.root_dir

    def _on_click_new_file(self):
        target_dir = self._resolve_target_dir()
        rel_dir = os.path.relpath(target_dir, self.root_dir)
        dir_name = "최상위 폴더" if rel_dir == "." else rel_dir

        filename = simpledialog.askstring(
            "새 메모 파일 만들기",
            f"[{dir_name}]에 생성할 파일 이름을 입력하세요:\n(예: 회의록.md, 일기.txt)",
            parent=self.winfo_toplevel()
        )
        if filename:
            try:
                new_path = FileManager.create_file(target_dir, filename)
                self.refresh()
                self._select_and_open_path(new_path)
            except Exception as e:
                messagebox.showerror("오류", str(e), parent=self.winfo_toplevel())

    def _on_click_new_folder(self):
        target_dir = self._resolve_target_dir()
        rel_dir = os.path.relpath(target_dir, self.root_dir)
        dir_name = "최상위 폴더" if rel_dir == "." else rel_dir

        foldername = simpledialog.askstring(
            "새 폴더 만들기",
            f"[{dir_name}]에 생성할 폴더 이름을 입력하세요:",
            parent=self.winfo_toplevel()
        )
        if foldername:
            try:
                FileManager.create_folder(target_dir, foldername)
                self.refresh()
            except Exception as e:
                messagebox.showerror("오류", str(e), parent=self.winfo_toplevel())

    def _on_click_rename(self):
        path = self.get_selected_path()
        if not path:
            return
        curr_name = os.path.basename(path)
        new_name = simpledialog.askstring(
            "이름 변경",
            f"'{curr_name}'의 새로운 이름을 입력하세요:",
            initialvalue=curr_name,
            parent=self.winfo_toplevel()
        )
        if new_name and new_name != curr_name:
            try:
                new_path = FileManager.rename(path, new_name)
                self.refresh()
                if os.path.isfile(new_path):
                    self._select_and_open_path(new_path)
            except Exception as e:
                messagebox.showerror("오류", str(e), parent=self.winfo_toplevel())

    def _on_click_delete(self):
        path = self.get_selected_path()
        if not path:
            return
        name = os.path.basename(path)
        is_dir = os.path.isdir(path)
        target_type = "폴더" if is_dir else "파일"

        if messagebox.askyesno("삭제 확인", f"정말로 {target_type} '{name}'을(를) 삭제하시겠습니까?", parent=self.winfo_toplevel()):
            try:
                FileManager.delete(path)
                self.refresh()
            except Exception as e:
                messagebox.showerror("오류", str(e), parent=self.winfo_toplevel())

    def _on_open_in_finder(self):
        path = self.get_selected_path() or self.root_dir
        folder_to_open = path if os.path.isdir(path) else os.path.dirname(path)
        try:
            if sys.platform == "darwin":
                subprocess.run(["open", folder_to_open])
            elif sys.platform == "win32":
                subprocess.run(["explorer", folder_to_open])
            else:
                subprocess.run(["xdg-open", folder_to_open])
        except Exception as e:
            messagebox.showerror("오류", f"폴더 열기 실패: {str(e)}", parent=self.winfo_toplevel())

    def _select_and_open_path(self, target_path: str):
        for node_id, path in self.item_paths.items():
            if path == target_path:
                self.tree.selection_set(node_id)
                self.tree.see(node_id)
                if os.path.isfile(target_path):
                    self.on_file_selected(target_path)
                break
