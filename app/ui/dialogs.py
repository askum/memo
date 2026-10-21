"""Dialog windows for categories and confirmations."""
import customtkinter as ctk
from typing import Optional, Callable


class InputDialog(ctk.CTkToplevel):
    """Custom modal input dialog for category name and icon."""
    def __init__(self, parent, title: str, prompt: str, initial_text: str = "", initial_icon: str = "📁", on_submit: Optional[Callable[[str, str], None]] = None):
        super().__init__(parent)
        self.title(title)
        self.geometry("380x240")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self.on_submit = on_submit
        self.result = None

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        # Title / Prompt label
        lbl_prompt = ctk.CTkLabel(self, text=prompt, font=ctk.CTkFont(size=14, weight="bold"))
        lbl_prompt.pack(padx=20, pady=(20, 10), anchor="w")

        # Icons row
        icon_frame = ctk.CTkFrame(self, fg_color="transparent")
        icon_frame.pack(padx=20, pady=(0, 10), fill="x")

        self.selected_icon = ctk.StringVar(value=initial_icon)
        icon_options = ["📁", "💼", "🏡", "💡", "📚", "🎯", "⭐", "📝"]
        
        icon_label = ctk.CTkLabel(icon_frame, text="아이콘:", font=ctk.CTkFont(size=13))
        icon_label.pack(side="left", padx=(0, 10))

        self.icon_menu = ctk.CTkOptionMenu(
            icon_frame,
            values=icon_options,
            variable=self.selected_icon,
            width=80
        )
        self.icon_menu.pack(side="left")

        # Text Entry
        self.entry = ctk.CTkEntry(self, placeholder_text="카테고리 이름을 입력하세요", width=340, height=36)
        self.entry.pack(padx=20, pady=(0, 20))
        if initial_text:
            self.entry.insert(0, initial_text)
        self.entry.focus_set()
        self.entry.bind("<Return>", lambda e: self._confirm())
        self.entry.bind("<Escape>", lambda e: self.destroy())

        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(padx=20, pady=(0, 15), fill="x", side="bottom")

        btn_cancel = ctk.CTkButton(btn_frame, text="취소", fg_color="transparent", border_width=1, width=80, command=self.destroy)
        btn_cancel.pack(side="right", padx=(10, 0))

        btn_ok = ctk.CTkButton(btn_frame, text="확인", width=80, command=self._confirm)
        btn_ok.pack(side="right")

        # Center dialog relative to parent
        self.update_idletasks()
        try:
            x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
            y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
            self.geometry(f"+{x}+{y}")
        except Exception:
            pass

    def _confirm(self):
        text = self.entry.get().strip()
        if not text:
            return
        icon = self.selected_icon.get()
        self.result = (text, icon)
        if self.on_submit:
            self.on_submit(text, icon)
        self.destroy()


class ConfirmDialog(ctk.CTkToplevel):
    """Confirmation modal dialog."""
    def __init__(self, parent, title: str, message: str, on_confirm: Callable[[], None]):
        super().__init__(parent)
        self.title(title)
        self.geometry("360x170")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self.on_confirm = on_confirm

        lbl = ctk.CTkLabel(self, text=message, font=ctk.CTkFont(size=14), wraplength=320)
        lbl.pack(padx=20, pady=(25, 20), expand=True)

        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(padx=20, pady=(0, 15), fill="x", side="bottom")

        btn_cancel = ctk.CTkButton(btn_frame, text="취소", fg_color="transparent", border_width=1, width=80, command=self.destroy)
        btn_cancel.pack(side="right", padx=(10, 0))

        btn_ok = ctk.CTkButton(btn_frame, text="삭제", fg_color="#E53935", hover_color="#C62828", width=80, command=self._confirm)
        btn_ok.pack(side="right")

        # Center
        self.update_idletasks()
        try:
            x = parent.winfo_x() + (parent.winfo_width() - self.winfo_width()) // 2
            y = parent.winfo_y() + (parent.winfo_height() - self.winfo_height()) // 2
            self.geometry(f"+{x}+{y}")
        except Exception:
            pass

    def _confirm(self):
        if self.on_confirm:
            self.on_confirm()
        self.destroy()
