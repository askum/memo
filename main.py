#!/usr/bin/env python3
"""Desktop Memo Application Entry Point."""
import os
import sys

# Suppress macOS Tkinter deprecation warning
os.environ["TK_SILENCE_DEPRECATION"] = "1"

# Ensure workspace root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.ui.main_window import MainWindow


def main():
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
