import sqlite3
import pytest
from quant.seed_metric_config import seed_db

def test_seed_idempotency(tmp_path):
    db_file = str(tmp_path / "test_seed.db")
    
    # 1. First seed
    seed_db(db_file)
    
    # Verify we have seeded rows
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT t_minus_2, t_minus_1, t_plus_1, t_plus_2 FROM metric_config WHERE metric_name = ?", ("aviv_ratio",))
    row = cursor.fetchone()
    assert row is not None
    assert row[0] == 2.0   # t_minus_2
    assert row[1] == 1.0   # t_minus_1
    assert row[2] == -1.0  # t_plus_1
    assert row[3] == -2.0  # t_plus_2
    
    # 2. Modify a row to simulate a user customization
    cursor.execute("""
        UPDATE metric_config
        SET t_minus_2 = -5.0, t_minus_1 = -3.0
        WHERE metric_name = ?
    """, ("aviv_ratio",))
    conn.commit()
    
    # Verify modification succeeded
    cursor.execute("SELECT t_minus_2, t_minus_1 FROM metric_config WHERE metric_name = ?", ("aviv_ratio",))
    row = cursor.fetchone()
    assert row[0] == -5.0
    assert row[1] == -3.0
    
    # 3. Seed again
    seed_db(db_file)
    
    # 4. Assert that the modification is preserved (not overwritten by the seed)
    cursor.execute("SELECT t_minus_2, t_minus_1 FROM metric_config WHERE metric_name = ?", ("aviv_ratio",))
    row = cursor.fetchone()
    assert row[0] == -5.0
    assert row[1] == -3.0
    
    # Also assert that other metrics that weren't modified still exist and have their default values
    cursor.execute("SELECT t_minus_2, t_minus_1 FROM metric_config WHERE metric_name = ?", ("mvrv_z",))
    row_mvrv = cursor.fetchone()
    assert row_mvrv is not None
    assert row_mvrv[0] == 6.65 # t_minus_2
    assert row_mvrv[1] == 4.6  # t_minus_1
    
    conn.close()
