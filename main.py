#!/usr/bin/env python3
"""Desktop Memo Application Entry Point."""
import os
import sys

# Suppress macOS Tkinter deprecation warning
os.environ["TK_SILENCE_DEPRECATION"] = "1"

# Ensure workspace root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import customtkinter as ctk
from app.database import Database
from app.ui.app_window import AppWindow


def main():
    # Set default CustomTkinter appearance
    ctk.set_appearance_mode("System")  # "System", "Dark", "Light"
    ctk.set_default_color_theme("blue")

    # Initialize database
    db = Database()

    # Launch application window
    app = AppWindow(db)
    app.mainloop()


if __name__ == "__main__":
    main()
