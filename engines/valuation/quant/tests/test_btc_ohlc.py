import pytest
import sqlite3
from unittest.mock import patch
from database.db import get_connection
from quant.btc_ohlc import run_pipeline

@pytest.fixture
def temp_db(tmp_path):
    db_file = str(tmp_path / "test_ohlc.db")
    return db_file

@patch('quant.btc_ohlc.fetch_bitview_ohlc')
def test_btc_ohlc_incremental_pipeline(mock_fetch, temp_db):
    # Mock data with 5 records
    mock_data = [
        {"date": "2026-06-01T00:00:00Z", "open": 100.0, "high": 110.0, "low": 90.0, "close": 105.0},
        {"date": "2026-06-02T00:00:00Z", "open": 105.0, "high": 115.0, "low": 95.0, "close": 110.0},
        {"date": "2026-06-03T00:00:00Z", "open": 110.0, "high": 120.0, "low": 100.0, "close": 115.0},
        {"date": "2026-06-04T00:00:00Z", "open": 115.0, "high": 125.0, "low": 105.0, "close": 120.0},
        {"date": "2026-06-05T00:00:00Z", "open": 120.0, "high": 130.0, "low": 110.0, "close": 125.0},
    ]
    mock_fetch.return_value = mock_data

    # 1. First run with empty database (delta mode) should fetch and insert all 5 rows
    inserted = run_pipeline(db_path=temp_db, full_rebuild=False)
    assert inserted == 5

    # Verify rows in DB
    conn = get_connection(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*), max(date) FROM btc_ohlc")
    count, max_date = cursor.fetchone()
    assert count == 5
    assert max_date == "2026-06-05T00:00:00Z"
    conn.close()

    # 2. Add two new rows to mock data
    mock_data_new = mock_data + [
        {"date": "2026-06-06T00:00:00Z", "open": 125.0, "high": 135.0, "low": 115.0, "close": 130.0},
        {"date": "2026-06-07T00:00:00Z", "open": 130.0, "high": 140.0, "low": 120.0, "close": 135.0},
    ]
    mock_fetch.return_value = mock_data_new

    # 3. Second run in delta mode (full_rebuild=False) should ONLY insert 2 rows
    inserted_delta = run_pipeline(db_path=temp_db, full_rebuild=False)
    assert inserted_delta == 2

    # Verify rows in DB (total should be 7, max date should be 2026-06-07)
    conn = get_connection(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*), max(date) FROM btc_ohlc")
    count, max_date = cursor.fetchone()
    assert count == 7
    assert max_date == "2026-06-07T00:00:00Z"
    conn.close()

    # 4. Third run with full rebuild (full_rebuild=True) should write all 7 rows
    inserted_rebuild = run_pipeline(db_path=temp_db, full_rebuild=True)
    assert inserted_rebuild == 7
