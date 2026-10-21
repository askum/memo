"""Left sidebar panel: Category and folder management, theme switcher."""
import tkinter as tk
import customtkinter as ctk
from typing import Callable, Optional, Dict, Any, List
from .dialogs import InputDialog, ConfirmDialog


class Sidebar(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_select_category: Callable[[Optional[int]], None],
        on_add_category: Callable[[str, str], None],
        on_edit_category: Callable[[int, str, str], None],
        on_delete_category: Callable[[int], None],
        **kwargs
    ):
        super().__init__(master, width=230, corner_radius=0, **kwargs)
        self.grid_propagate(False)

        self.on_select_category = on_select_category
        self.on_add_category = on_add_category
        self.on_edit_category = on_edit_category
        self.on_delete_category = on_delete_category

        self.selected_category_id: Optional[int] = None
        self.category_buttons: Dict[Optional[int], ctk.CTkButton] = {}

        self._setup_ui()

    def _setup_ui(self):
        # App Title Header
        title_frame = ctk.CTkFrame(self, fg_color="transparent")
        title_frame.pack(fill="x", padx=16, pady=(18, 12))

        app_title = ctk.CTkLabel(
            title_frame,
            text="📝 My Memo",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        app_title.pack(side="left")

        # Divider
        sep1 = ctk.CTkFrame(self, height=1, fg_color=("gray80", "gray30"))
        sep1.pack(fill="x", padx=14, pady=(0, 10))

        # "All Notes" item
        self.all_notes_btn = ctk.CTkButton(
            self,
            text="📑  전체 메모",
            anchor="w",
            height=36,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("gray85", "#2B2B2B"),
            text_color=("gray10", "gray95"),
            hover_color=("gray75", "#383838"),
            command=lambda: self._handle_category_click(None)
        )
        self.all_notes_btn.pack(fill="x", padx=12, pady=(0, 10))
        self.category_buttons[None] = self.all_notes_btn

        # Category section header with "+ 새 폴더" button
        cat_header_frame = ctk.CTkFrame(self, fg_color="transparent")
        cat_header_frame.pack(fill="x", padx=16, pady=(8, 6))

        cat_title = ctk.CTkLabel(
            cat_header_frame,
            text="카테고리",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=("gray50", "gray60")
        )
        cat_title.pack(side="left")

        btn_add = ctk.CTkButton(
            cat_header_frame,
            text="+",
            width=26,
            height=24,
            font=ctk.CTkFont(size=16, weight="bold"),
            fg_color="transparent",
            hover_color=("gray80", "#383838"),
            text_color=("gray20", "gray80"),
            command=self._show_add_category_dialog
        )
        btn_add.pack(side="right")

        # Scrollable list for categories
        self.cat_scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.cat_scroll_frame.pack(fill="both", expand=True, padx=6, pady=2)

        # Bottom section: Theme switcher
        bottom_frame = ctk.CTkFrame(self, fg_color="transparent")
        bottom_frame.pack(fill="x", side="bottom", padx=12, pady=12)

        lbl_theme = ctk.CTkLabel(bottom_frame, text="테마:", font=ctk.CTkFont(size=11), text_color=("gray50", "gray60"))
        lbl_theme.pack(side="left", padx=(4, 6))

        self.theme_menu = ctk.CTkOptionMenu(
            bottom_frame,
            values=["System", "Dark", "Light"],
            command=self._change_theme,
            width=100,
            height=26,
            font=ctk.CTkFont(size=11)
        )
        self.theme_menu.set("Dark" if ctk.get_appearance_mode() == "Dark" else "System")
        self.theme_menu.pack(side="right")

    def _change_theme(self, new_mode: str):
        ctk.set_appearance_mode(new_mode)

    def update_categories(self, categories: List[Dict[str, Any]], total_count: int):
        """Rebuild the category buttons in the sidebar."""
        self.all_notes_btn.configure(text=f"📑  전체 메모 ({total_count})")

        # Clear existing category buttons
        for widget in self.cat_scroll_frame.winfo_children():
            widget.destroy()
        
        self.category_buttons = {None: self.all_notes_btn}

        for cat in categories:
            cat_id = cat["id"]
            name = cat["name"]
            icon = cat.get("icon") or "📁"
            count = cat.get("note_count", 0)

            # Container row
            row = ctk.CTkFrame(self.cat_scroll_frame, fg_color="transparent")
            row.pack(fill="x", pady=2)

            is_selected = (self.selected_category_id == cat_id)
            btn_fg = ("gray85", "#2B2B2B") if is_selected else "transparent"
            btn_text_color = ("black", "white") if is_selected else ("gray20", "gray85")

            btn = ctk.CTkButton(
                row,
                text=f"{icon}  {name} ({count})",
                anchor="w",
                height=34,
                font=ctk.CTkFont(size=12, weight="bold" if is_selected else "normal"),
                fg_color=btn_fg,
                text_color=btn_text_color,
                hover_color=("gray80", "#383838"),
                command=lambda cid=cat_id: self._handle_category_click(cid)
            )
            btn.pack(side="left", fill="x", expand=True)
            self.category_buttons[cat_id] = btn

            # Settings/dots button for category actions
            btn_options = ctk.CTkButton(
                row,
                text="⋯",
                width=24,
                height=34,
                fg_color="transparent",
                hover_color=("gray80", "#383838"),
                text_color=("gray50", "gray60"),
                command=lambda cid=cat_id, cname=name, cicon=icon, b=row: self._show_category_menu(cid, cname, cicon, b)
            )
            btn_options.pack(side="right", padx=(2, 0))

        # Re-highlight active category
        self._highlight_active_button()

    def _handle_category_click(self, category_id: Optional[int]):
        self.selected_category_id = category_id
        self._highlight_active_button()
        self.on_select_category(category_id)

    def _highlight_active_button(self):
        for cid, btn in self.category_buttons.items():
            if cid == self.selected_category_id:
                btn.configure(
                    fg_color=("gray85", "#2B2B2B"),
                    text_color=("black", "white"),
                    font=ctk.CTkFont(size=12, weight="bold")
                )
            else:
                btn.configure(
                    fg_color="transparent",
                    text_color=("gray20", "gray85"),
                    font=ctk.CTkFont(size=12, weight="normal")
                )

    def _show_add_category_dialog(self):
        InputDialog(
            self.winfo_toplevel(),
            title="새 카테고리 추가",
            prompt="새로운 카테고리 이름을 입력하세요:",
            on_submit=lambda name, icon: self.on_add_category(name, icon)
        )

    def _show_category_menu(self, category_id: int, current_name: str, current_icon: str, widget_anchor):
        menu = tk.Menu(self, tearoff=0)
        menu.add_command(
            label="✏️ 이름/아이콘 변경",
            command=lambda: self._show_edit_category_dialog(category_id, current_name, current_icon)
        )
        menu.add_command(
            label="🗑️ 카테고리 삭제",
            command=lambda: self._show_delete_category_dialog(category_id, current_name)
        )
        
        try:
            x = widget_anchor.winfo_rootx() + widget_anchor.winfo_width() - 80
            y = widget_anchor.winfo_rooty() + widget_anchor.winfo_height()
            menu.tk_popup(x, y)
        finally:
            menu.grab_release()

    def _show_edit_category_dialog(self, category_id: int, name: str, icon: str):
        InputDialog(
            self.winfo_toplevel(),
            title="카테고리 수정",
            prompt="카테고리 이름과 아이콘을 수정하세요:",
            initial_text=name,
            initial_icon=icon,
            on_submit=lambda new_name, new_icon: self.on_edit_category(category_id, new_name, new_icon)
        )

    def _show_delete_category_dialog(self, category_id: int, name: str):
        ConfirmDialog(
            self.winfo_toplevel(),
            title="카테고리 삭제 확인",
            message=f"'{name}' 카테고리를 삭제하시겠습니까?\n(포함된 메모는 삭제되지 않고 '미분류'로 유지됩니다.)",
            on_confirm=lambda: self.on_delete_category(category_id)
        )
