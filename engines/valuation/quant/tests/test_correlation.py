import pytest
import numpy as np
from quant.audit.correlation import compute_pairwise_correlation, run_correlation_analysis
from database.db import init_db, insert_metric, get_connection

def test_compute_pairwise_correlation_perfect():
    x = [float(i) for i in range(20)]
    y = [float(i) for i in range(20)]
    p, s = compute_pairwise_correlation(x, y)
    assert abs(p - 1.0) < 1e-7
    assert abs(s - 1.0) < 1e-7

    y_inv = [float(-i) for i in range(20)]
    p_inv, s_inv = compute_pairwise_correlation(x, y_inv)
    assert abs(p_inv - (-1.0)) < 1e-7
    assert abs(s_inv - (-1.0)) < 1e-7

def test_compute_pairwise_correlation_uncorrelated():
    np.random.seed(42)
    x = list(np.random.normal(0.0, 1.0, 50))
    y = list(np.random.normal(0.0, 1.0, 50))
    p, s = compute_pairwise_correlation(x, y)
    # With random series, correlations should be small (not perfectly 0, but far from 1)
    assert abs(p) < 0.3
    assert abs(s) < 0.3

def test_compute_pairwise_correlation_insufficient():
    x = [1.0, 2.0, 3.0]
    y = [4.0, 5.0, 6.0]
    p, s = compute_pairwise_correlation(x, y)
    assert p == 0.0
    assert s == 0.0

def test_run_correlation_analysis_db(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    init_db(db_file)
    
    # Insert two metrics y = x and y = -x
    run_date = "2026-06-01"
    for i in range(30):
        date_str = f"2026-05-{i+1:02d}"
        insert_metric(
            date=date_str,
            metric_name="metric_a",
            raw_value=float(i),
            normalized_value=float(i),
            btc_price=60000.0,
            db_path=db_file
        )
        insert_metric(
            date=date_str,
            metric_name="metric_b",
            raw_value=float(i),
            normalized_value=-float(i),
            btc_price=60000.0,
            db_path=db_file
        )
        
    corrs = run_correlation_analysis(db_file, run_date)
    assert len(corrs) == 1
    entry = corrs[0]
    assert entry["metric_a"] == "metric_a"
    assert entry["metric_b"] == "metric_b"
    assert abs(entry["pearson"] - (-1.0)) < 1e-7
    assert entry["highly_correlated"] is True
    
    # Check database
    conn = get_connection(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_correlation_matrix WHERE run_date = ?", (run_date,))
    row = cursor.fetchone()
    assert row is not None
    assert row["metric_a"] == "metric_a"
    assert row["metric_b"] == "metric_b"
    assert abs(row["pearson"] - (-1.0)) < 1e-7
    conn.close()
