#!/usr/bin/env python3
"""
migrate_timeseries_date_format.py
──────────────────────────────────
One-off migration: convert all plain-format dates (YYYY-MM-DD) in
`timeseries_metrics` (engines/valuation/database/metrics.db) to the
standard T-format (YYYY-MM-DDT00:00:00Z) used by bitview_client.py.

Logic:
  For each row where date NOT LIKE '%T%':
    - Compute t_date = plain_date + "T00:00:00Z"
    - If a T-format row already exists for (metric_name, t_date):
        DELETE the plain-format row  (it's a true duplicate)
    - Else:
        UPDATE the date string in-place to t_date

Safe to re-run (idempotent after first run).
Uses SQLite WAL connection for concurrency safety.
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

DB_PATH = os.path.join(BASE_DIR, "engines/valuation/database/metrics.db")


def get_wal_conn(db_path: str):
    """Open a SQLite WAL-mode connection."""
    try:
        from db_connector import get_wal_connection
        return get_wal_connection(db_path)
    except ImportError:
        import sqlite3
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn


def run_migration(db_path: str = DB_PATH) -> None:
    if not os.path.exists(db_path):
        logger.error(f"Database not found: {db_path}")
        sys.exit(1)

    conn = get_wal_conn(db_path)
    conn.row_factory = __import__("sqlite3").Row
    cursor = conn.cursor()

    # Count total plain-format rows before migration
    cursor.execute("SELECT COUNT(*) FROM timeseries_metrics WHERE date NOT LIKE '%T%'")
    total_plain = cursor.fetchone()[0]
    logger.info(f"Plain-format rows found before migration: {total_plain}")

    if total_plain == 0:
        logger.info("Nothing to migrate — all dates are already in T-format.")
        conn.close()
        return

    # Fetch all plain-format rows
    cursor.execute(
        "SELECT rowid, metric_name, date FROM timeseries_metrics WHERE date NOT LIKE '%T%'"
    )
    plain_rows = cursor.fetchall()

    updated = 0
    deleted = 0
    errors = 0

    for row in plain_rows:
        rowid = row[0]
        metric_name = row[1]
        plain_date = row[2]

        # Compute T-format equivalent
        t_date = plain_date + "T00:00:00Z"

        try:
            # Check if T-format row already exists for this (metric_name, t_date)
            cursor.execute(
                "SELECT COUNT(*) FROM timeseries_metrics WHERE metric_name = ? AND date = ?",
                (metric_name, t_date),
            )
            exists = cursor.fetchone()[0] > 0

            if exists:
                # True duplicate — delete the plain-format row
                cursor.execute(
                    "DELETE FROM timeseries_metrics WHERE rowid = ?",
                    (rowid,),
                )
                deleted += 1
            else:
                # No T-format counterpart — rename in-place
                cursor.execute(
                    "UPDATE timeseries_metrics SET date = ? WHERE rowid = ?",
                    (t_date, rowid),
                )
                updated += 1

        except Exception as e:
            logger.error(
                f"Error processing row rowid={rowid} metric={metric_name} date={plain_date}: {e}"
            )
            errors += 1

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM timeseries_metrics WHERE date NOT LIKE '%T%'")
    remaining = cursor.fetchone()[0]
    conn.close()

    logger.info("─" * 60)
    logger.info(f"Migration complete.")
    logger.info(f"  Rows renamed to T-format : {updated}")
    logger.info(f"  Duplicate rows deleted   : {deleted}")
    logger.info(f"  Errors                   : {errors}")
    logger.info(f"  Plain-format rows remaining: {remaining}")
    logger.info("─" * 60)

    if remaining > 0:
        logger.error(
            f"WARN: {remaining} plain-format rows still remain after migration — "
            "inspect manually."
        )
        sys.exit(1)
    else:
        logger.info("✓ All dates are now in YYYY-MM-DDT00:00:00Z format.")


if __name__ == "__main__":
    run_migration()
