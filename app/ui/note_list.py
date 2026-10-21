"""Middle panel: Note list with search, sorting, and preview cards."""
import customtkinter as ctk
from typing import Callable, Optional, Dict, Any, List
from ..utils import format_timestamp, get_snippet


class NoteCard(ctk.CTkFrame):
    def __init__(self, master, note: Dict[str, Any], is_selected: bool, on_click: Callable[[int], None]):
        bg_color = ("gray80", "#2d3748") if is_selected else ("gray92", "#1e2430")
        border_color = ("#3B82F6", "#60A5FA") if is_selected else ("gray85", "#283141")

        super().__init__(
            master,
            fg_color=bg_color,
            corner_radius=8,
            border_width=1,
            border_color=border_color
        )
        self.note = note
        self.note_id = note["id"]
        self.on_click = on_click

        self.bind("<Button-1>", self._on_card_click)

        # Title and Date row
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=12, pady=(10, 2))
        header.bind("<Button-1>", self._on_card_click)

        title_text = note["title"] or "제목 없음"
        if len(title_text) > 22:
            title_text = title_text[:22] + "..."

        lbl_title = ctk.CTkLabel(
            header,
            text=title_text,
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w"
        )
        lbl_title.pack(side="left", fill="x", expand=True)
        lbl_title.bind("<Button-1>", self._on_card_click)

        date_text = format_timestamp(note.get("updated_at"))
        lbl_date = ctk.CTkLabel(
            header,
            text=date_text,
            font=ctk.CTkFont(size=10),
            text_color=("gray50", "gray55")
        )
        lbl_date.pack(side="right")
        lbl_date.bind("<Button-1>", self._on_card_click)

        # Snippet preview
        snippet = get_snippet(note.get("content", ""))
        lbl_snippet = ctk.CTkLabel(
            self,
            text=snippet,
            font=ctk.CTkFont(size=11),
            text_color=("gray40", "gray60"),
            anchor="w",
            justify="left"
        )
        lbl_snippet.pack(fill="x", padx=12, pady=(0, 8))
        lbl_snippet.bind("<Button-1>", self._on_card_click)

        # Category Badge if available
        cat_name = note.get("category_name")
        cat_icon = note.get("category_icon") or "📁"
        if cat_name:
            badge_frame = ctk.CTkFrame(self, fg_color="transparent")
            badge_frame.pack(fill="x", padx=12, pady=(0, 8))
            badge_frame.bind("<Button-1>", self._on_card_click)

            lbl_badge = ctk.CTkLabel(
                badge_frame,
                text=f"{cat_icon} {cat_name}",
                font=ctk.CTkFont(size=10),
                text_color=("gray40", "gray55"),
                fg_color=("gray85", "#283141"),
                corner_radius=4,
                padx=6,
                pady=1
            )
            lbl_badge.pack(side="left")
            lbl_badge.bind("<Button-1>", self._on_card_click)

    def _on_card_click(self, event=None):
        self.on_click(self.note_id)


class NoteListPanel(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_select_note: Callable[[int], None],
        on_create_note: Callable[[], None],
        on_search: Callable[[str], None],
        **kwargs
    ):
        super().__init__(master, width=280, corner_radius=0, **kwargs)
        self.grid_propagate(False)

        self.on_select_note = on_select_note
        self.on_create_note = on_create_note
        self.on_search = on_search

        self.selected_note_id: Optional[int] = None
        self._search_after_id = None

        self._setup_ui()

    def _setup_ui(self):
        # Top Action Bar: Search & New Note
        top_bar = ctk.CTkFrame(self, fg_color="transparent")
        top_bar.pack(fill="x", padx=12, pady=(16, 8))

        self.search_entry = ctk.CTkEntry(
            top_bar,
            placeholder_text="🔍 검색...",
            height=32,
            font=ctk.CTkFont(size=12)
        )
        self.search_entry.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.search_entry.bind("<KeyRelease>", self._on_search_key)

        btn_new = ctk.CTkButton(
            top_bar,
            text="+",
            width=32,
            height=32,
            font=ctk.CTkFont(size=18, weight="bold"),
            command=self.on_create_note
        )
        btn_new.pack(side="right")

        # Header info
        self.lbl_info = ctk.CTkLabel(
            self,
            text="0개의 메모",
            font=ctk.CTkFont(size=11),
            text_color=("gray50", "gray60"),
            anchor="w"
        )
        self.lbl_info.pack(fill="x", padx=14, pady=(0, 6))

        # Scrollable note list container
        self.scroll_list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.scroll_list.pack(fill="both", expand=True, padx=8, pady=(0, 8))

    def _on_search_key(self, event=None):
        if self._search_after_id:
            self.after_cancel(self._search_after_id)
        # Debounce search 250ms
        self._search_after_id = self.after(250, self._trigger_search)

    def _trigger_search(self):
        query = self.search_entry.get().strip()
        self.on_search(query)

    def update_notes(self, notes: List[Dict[str, Any]], selected_note_id: Optional[int] = None):
        self.selected_note_id = selected_note_id
        count = len(notes)
        self.lbl_info.configure(text=f"{count}개의 메모")

        # Clear existing cards
        for widget in self.scroll_list.winfo_children():
            widget.destroy()

        if not notes:
            empty_lbl = ctk.CTkLabel(
                self.scroll_list,
                text="작성된 메모가 없습니다.\n'+' 버튼을 눌러 새 메모를 만들어보세요!",
                font=ctk.CTkFont(size=12),
                text_color=("gray50", "gray60"),
                justify="center"
            )
            empty_lbl.pack(pady=40, padx=10)
            return

        for note in notes:
            is_selected = (note["id"] == self.selected_note_id)
            card = NoteCard(
                self.scroll_list,
                note=note,
                is_selected=is_selected,
                on_click=self.on_select_note
            )
            card.pack(fill="x", pady=4, padx=2)
