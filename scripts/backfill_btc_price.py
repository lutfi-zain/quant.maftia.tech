#!/usr/bin/env python3
"""
Backfill script: Updates all existing unified_daily_analytics.btc_price
to match master_ohlcv.close (canonical price source).

Usage:
    python3 scripts/backfill_btc_price.py

Idempotent: running twice modifies zero rows (all prices already match).
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from db_connector import get_wal_connection, execute_parameterized

DB_PATH = os.path.join(BASE_DIR, "data", "maftia_quant.db")


def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = get_wal_connection(DB_PATH)

    # Count divergent rows before backfill
    count_row = conn.execute("""
        SELECT COUNT(*)
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE m.close IS NOT NULL
          AND u.btc_price IS NOT NULL
          AND ABS(u.btc_price - m.close) > 0.01
    """).fetchone()
    divergent_before = count_row[0] if count_row else 0
    print(f"Divergent records before backfill: {divergent_before}")

    # Backfill: set btc_price = master_ohlcv.close for all matching dates
    cursor = conn.execute("""
        UPDATE unified_daily_analytics
        SET btc_price = (
            SELECT m.close
            FROM master_ohlcv m
            WHERE m.date = unified_daily_analytics.date
        )
        WHERE EXISTS (
            SELECT 1 FROM master_ohlcv m
            WHERE m.date = unified_daily_analytics.date
              AND m.close IS NOT NULL
              AND (
                  unified_daily_analytics.btc_price IS NULL
                  OR ABS(unified_daily_analytics.btc_price - m.close) > 0.01
              )
        )
    """)
    updated = cursor.rowcount
    conn.commit()

    # Set btc_price = NULL for dates without master_ohlcv record
    cursor2 = conn.execute("""
        UPDATE unified_daily_analytics
        SET btc_price = NULL
        WHERE btc_price IS NOT NULL
          AND date NOT IN (SELECT date FROM master_ohlcv)
    """)
    nullified = cursor2.rowcount
    conn.commit()

    # Verify: count remaining divergences
    count_row2 = conn.execute("""
        SELECT COUNT(*)
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE m.close IS NOT NULL
          AND u.btc_price IS NOT NULL
          AND ABS(u.btc_price - m.close) > 0.01
    """).fetchone()
    divergent_after = count_row2[0] if count_row2 else 0

    conn.close()

    print(f"Rows updated: {updated}")
    print(f"Rows nullified (no master_ohlcv): {nullified}")
    print(f"Divergent records after backfill: {divergent_after}")

    if divergent_after == 0:
        print("✓ Backfill complete — zero divergences remain.")
    else:
        print(f"✗ WARNING: {divergent_after} divergent records remain!")
        sys.exit(1)


if __name__ == "__main__":
    main()
