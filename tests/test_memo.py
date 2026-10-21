"""Unit and integration tests for Database, Models, and Utilities."""
import os
import tempfile
import unittest
from app.database import Database
from app.utils import format_timestamp, get_snippet, export_note_to_file


class TestMemoApp(unittest.TestCase):
    def setUp(self):
        # Create a temporary database file
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_memo.db")
        self.db = Database(self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_database_initialization(self):
        # Should initialize with default categories and welcome note
        categories = self.db.get_categories()
        self.assertGreaterEqual(len(categories), 3)

        notes = self.db.get_notes()
        self.assertGreaterEqual(len(notes), 1)
        self.assertIn("데스크톱 메모 앱", notes[0]["title"])

    def test_category_crud(self):
        # Add Category
        cat_id = self.db.add_category("프로젝트", "🚀")
        self.assertIsNotNone(cat_id)

        categories = {c["name"]: c for c in self.db.get_categories()}
        self.assertIn("프로젝트", categories)
        self.assertEqual(categories["프로젝트"]["icon"], "🚀")

        # Update Category
        self.db.update_category(cat_id, "완료된 프로젝트", "✅")
        categories_updated = {c["name"]: c for c in self.db.get_categories()}
        self.assertIn("완료된 프로젝트", categories_updated)

        # Delete Category
        self.db.delete_category(cat_id)
        categories_after_del = {c["name"]: c for c in self.db.get_categories()}
        self.assertNotIn("완료된 프로젝트", categories_after_del)

    def test_note_crud_and_search(self):
        # Create Category
        cat_id = self.db.add_category("독서", "📚")

        # Create Note
        note_id = self.db.create_note(
            title="클린 코드 독서 메모",
            content="함수는 한 가지 작업만 해야 한다.",
            category_id=cat_id
        )
        self.assertIsNotNone(note_id)

        # Retrieve Note
        note = self.db.get_note(note_id)
        self.assertEqual(note["title"], "클린 코드 독서 메모")
        self.assertEqual(note["category_name"], "독서")

        # Search Note
        search_results = self.db.get_notes(search_query="한 가지 작업")
        self.assertEqual(len(search_results), 1)
        self.assertEqual(search_results[0]["id"], note_id)

        # Update Note
        self.db.update_note(note_id, "클린 코드 핵심 요약", "리팩터링은 수시로 진행한다.", cat_id)
        updated_note = self.db.get_note(note_id)
        self.assertEqual(updated_note["title"], "클린 코드 핵심 요약")
        self.assertEqual(updated_note["content"], "리팩터링은 수시로 진행한다.")

        # Delete Note
        self.db.delete_note(note_id)
        deleted = self.db.get_note(note_id)
        self.assertIsNone(deleted)

    def test_utils(self):
        # Snippet test
        multiline_text = "\n\n첫 번째 줄 내용입니다.\n두 번째 줄입니다."
        snippet = get_snippet(multiline_text)
        self.assertEqual(snippet, "첫 번째 줄 내용입니다.")

        # Export test
        export_file = os.path.join(self.temp_dir.name, "exported_note.md")
        export_note_to_file(export_file, "테스트 메모", "본문 내용입니다.", "업무")
        self.assertTrue(os.path.exists(export_file))
        with open(export_file, "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("# 테스트 메모", content)
            self.assertIn("> 카테고리: 업무", content)


if __name__ == "__main__":
    unittest.main()
