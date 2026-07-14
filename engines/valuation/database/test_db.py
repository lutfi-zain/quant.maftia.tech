import os
import sqlite3
import pytest
from database.db import init_db, insert_metric, get_metrics, get_connection

TEST_DB_PATH = 'database/test_metrics.db'

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    yield
    # Teardown
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

def test_init_db_creates_schema_and_index():
    init_db(TEST_DB_PATH)
    
    conn = get_connection(TEST_DB_PATH)
    cursor = conn.cursor()
    
    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='timeseries_metrics'")
    table = cursor.fetchone()
    assert table is not None
    
    # Check columns
    cursor.execute("PRAGMA table_info(timeseries_metrics)")
    columns = {row['name']: row['type'] for row in cursor.fetchall()}
    assert columns['date'] == 'TEXT'
    assert columns['metric_name'] == 'TEXT'
    assert columns['raw_value'] == 'REAL'
    assert columns['normalized_value'] == 'REAL'
    assert columns['btc_price'] == 'REAL'
    
    # Check index exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_metric_date'")
    index = cursor.fetchone()
    assert index is not None
    
    conn.close()

def test_insert_and_get_metrics():
    init_db(TEST_DB_PATH)
    
    insert_metric('2023-01-01', 'test_metric', 10.5, 0.5, 20000.0, TEST_DB_PATH)
    insert_metric('2023-01-02', 'test_metric', 11.0, 0.6, 21000.0, TEST_DB_PATH)
    insert_metric('2023-01-01', 'other_metric', 5.0, 0.1, 20000.0, TEST_DB_PATH)
    
    results = get_metrics('test_metric', TEST_DB_PATH)
    
    assert len(results) == 2
    assert results[0]['date'] == '2023-01-01'
    assert results[0]['raw_value'] == 10.5
    assert results[0]['normalized_value'] == 0.5
    assert results[0]['btc_price'] == 20000.0
    
    assert results[1]['date'] == '2023-01-02'
    assert results[1]['raw_value'] == 11.0
