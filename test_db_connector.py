"""
Unit tests for db_connector.py.
Verifies SQLite WAL mode (`PRAGMA journal_mode=wal`) and multi-threaded concurrency behavior.
"""
import unittest
import os
import tempfile
import threading
from db_connector import get_wal_connection, execute_parameterized

class TestDBConnector(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_wal.db")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_journal_mode_is_wal(self):
        """Verify that get_wal_connection initializes journal_mode to wal and busy_timeout."""
        conn = get_wal_connection(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode;")
            mode = cursor.fetchone()[0]
            self.assertEqual(mode.lower(), "wal")
            
            cursor.execute("PRAGMA busy_timeout;")
            timeout = cursor.fetchone()[0]
            self.assertEqual(timeout, 10000)
        finally:
            conn.close()

    def test_execute_parameterized(self):
        """Verify parameterized execution works cleanly and commits."""
        conn = get_wal_connection(self.db_path)
        try:
            execute_parameterized(
                conn,
                "CREATE TABLE IF NOT EXISTS test_table (id INT PRIMARY KEY, val TEXT)"
            )
            execute_parameterized(
                conn,
                "INSERT OR REPLACE INTO test_table VALUES (?, ?)",
                (1, "alpha")
            )
            
            cursor = execute_parameterized(conn, "SELECT val FROM test_table WHERE id = ?", (1,), commit=False)
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row[0], "alpha")
        finally:
            conn.close()

    def test_multithreaded_concurrency(self):
        """Simulate concurrent reader and writer threads to verify no 'database is locked' errors occur."""
        # Initialize table first
        conn = get_wal_connection(self.db_path)
        execute_parameterized(
            conn,
            "CREATE TABLE IF NOT EXISTS shared_data (id INT PRIMARY KEY, val TEXT)"
        )
        conn.close()

        errors = []

        def writer_thread(start_id: int, count: int):
            try:
                wconn = get_wal_connection(self.db_path)
                for i in range(start_id, start_id + count):
                    execute_parameterized(
                        wconn,
                        "INSERT OR REPLACE INTO shared_data VALUES (?, ?)",
                        (i, f"val_{i}")
                    )
                wconn.close()
            except Exception as e:
                errors.append(e)

        def reader_thread():
            try:
                rconn = get_wal_connection(self.db_path)
                for _ in range(20):
                    cursor = execute_parameterized(rconn, "SELECT count(*) FROM shared_data", commit=False)
                    cursor.fetchone()
                rconn.close()
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=writer_thread, args=(1, 50)),
            threading.Thread(target=writer_thread, args=(101, 50)),
            threading.Thread(target=reader_thread),
            threading.Thread(target=reader_thread)
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Encountered concurrency errors: {errors}")

if __name__ == "__main__":
    unittest.main()
