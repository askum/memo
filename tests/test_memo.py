"""Unit tests for FileManager and Config."""
import os
import tempfile
import unittest
from app.file_manager import FileManager
from app.config import Config


class TestFileManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = self.temp_dir.name

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_seed_and_tree(self):
        # Initial seed
        FileManager.ensure_initial_seed(self.root)
        tree = FileManager.get_directory_tree(self.root)
        self.assertGreaterEqual(len(tree), 3)

        names = [item["name"] for item in tree]
        self.assertIn("업무", names)
        self.assertIn("환영합니다.md", names)

    def test_create_and_read_file(self):
        filepath = FileManager.create_file(self.root, "test_note.md")
        self.assertTrue(os.path.exists(filepath))

        content = FileManager.read_file(filepath)
        self.assertIn("# test_note", content)

        # Write and read back
        FileManager.write_file(filepath, "수정된 내용입니다.")
        self.assertEqual(FileManager.read_file(filepath), "수정된 내용입니다.")

    def test_create_folder_and_nested_file(self):
        folder_path = FileManager.create_folder(self.root, "하위폴더")
        self.assertTrue(os.path.isdir(folder_path))

        nested_file = FileManager.create_file(folder_path, "중첩메모.txt")
        self.assertTrue(os.path.isfile(nested_file))

        tree = FileManager.get_directory_tree(self.root)
        subfolder_item = next(item for item in tree if item["name"] == "하위폴더")
        self.assertEqual(len(subfolder_item["children"]), 1)
        self.assertEqual(subfolder_item["children"][0]["name"], "중첩메모.txt")

    def test_rename_and_delete(self):
        filepath = FileManager.create_file(self.root, "삭제할메모.md")
        self.assertTrue(os.path.exists(filepath))

        # Rename
        renamed_path = FileManager.rename(filepath, "이름변경된메모.md")
        self.assertFalse(os.path.exists(filepath))
        self.assertTrue(os.path.exists(renamed_path))

        # Delete
        FileManager.delete(renamed_path)
        self.assertFalse(os.path.exists(renamed_path))


if __name__ == "__main__":
    unittest.main()
