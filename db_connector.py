"""
Shared SQLite Write-Ahead Logging (WAL) Mode Connection Utility for `quant.maftia.tech`.
Provides concurrent read/write access without raising 'database is locked' errors.
"""
import sqlite3
import os
from typing import Optional, Any

def get_wal_connection(db_path: str, timeout: float = 10.0) -> sqlite3.Connection:
    """
    Establishes and returns an SQLite connection configured with WAL mode.
    
    Args:
        db_path (str): Absolute or relative file path to the SQLite database.
        timeout (float): SQLite busy timeout in seconds when waiting for locks (default: 10s).
        
    Returns:
        sqlite3.Connection: Configured database connection handle.
    """
    # Ensure parent directory exists if creating new database inside a nested path
    parent_dir = os.path.dirname(os.path.abspath(db_path))
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)

    conn = sqlite3.connect(db_path, timeout=timeout)
    
    # Enforce SQLite WAL concurrency settings
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=10000;")
    cursor.close()
    
    return conn

def execute_parameterized(
    conn: sqlite3.Connection,
    sql: str,
    params: tuple = (),
    commit: bool = True
) -> sqlite3.Cursor:
    """
    Executes a parameterized SQL query safely using ?-style placeholders.
    
    Args:
        conn (sqlite3.Connection): Active database connection.
        sql (str): SQL query containing ?-style parameter placeholders.
        params (tuple): Parameters to bind to the query.
        commit (bool): Whether to commit the transaction automatically if writing.
        
    Returns:
        sqlite3.Cursor: Result cursor.
    """
    cursor = conn.cursor()
    cursor.execute(sql, params)
    if commit and not sql.strip().upper().startswith("SELECT"):
        conn.commit()
    return cursor
