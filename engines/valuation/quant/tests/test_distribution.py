import pytest
import numpy as np
import os
from quant.audit.distribution import compute_distribution_stats, run_distribution_analysis
from database.db import init_db, get_connection, insert_metric

def test_compute_distribution_stats_empty():
    stats = compute_distribution_stats([], [])
    assert stats["count"] == 0
    assert stats["data_insufficient"] is True
    assert stats["mean"] == 0.0

def test_compute_distribution_stats_insufficient():
    # Only 5 data points
    norm = [1.0, 1.5, 2.0, -1.0, -2.0]
    raw = [10.0, 15.0, 20.0, -10.0, -20.0]
    stats = compute_distribution_stats(norm, raw)
    assert stats["count"] == 5
    assert stats["data_insufficient"] is True
    assert stats["mean"] == np.mean(norm)
    assert stats["min_val"] == -2.0
    assert stats["max_val"] == 2.0
    assert stats["pct_at_plus2"] == 0.2
    assert stats["pct_at_minus2"] == 0.2

def test_compute_distribution_stats_sufficient():
    # 35 data points (sufficient)
    norm = list(np.random.normal(loc=0.0, scale=1.0, size=35))
    raw = [v * 10 for v in norm]
    stats = compute_distribution_stats(norm, raw)
    assert stats["count"] == 35
    assert stats["data_insufficient"] is False
    assert abs(stats["mean"] - np.mean(norm)) < 1e-7
    assert stats["std"] > 0

def test_run_distribution_analysis_db(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    init_db(db_file)
    
    # Insert some dummy metrics
    metric_name = "test_metric"
    run_date = "2026-06-01"
    
    # 35 points to make it sufficient
    for i in range(35):
        date_str = f"2026-05-{i+1:02d}"
        insert_metric(
            date=date_str,
            metric_name=metric_name,
            raw_value=float(i),
            normalized_value=float(i) / 35.0 * 4.0 - 2.0, # range from -2 to +2
            btc_price=60000.0 + i,
            db_path=db_file
        )
        
    analysis = run_distribution_analysis(db_file, run_date)
    assert metric_name in analysis
    stats = analysis[metric_name]
    assert stats["count"] == 35
    assert stats["data_insufficient"] is False
    
    # Query database to make sure it was stored
    conn = get_connection(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_indicator_stats WHERE metric_name = ? AND run_date = ?", (metric_name, run_date))
    row = cursor.fetchone()
    assert row is not None
    assert row["count"] == 35
    assert row["mean"] is not None
    conn.close()
