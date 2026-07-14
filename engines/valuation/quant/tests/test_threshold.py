import pytest
import numpy as np
from quant.audit.threshold import validate_thresholds, run_threshold_validation
from database.db import init_db, insert_metric, get_connection

def test_validate_thresholds_insufficient():
    # Less than 30 points
    raw = [float(i) for i in range(10)]
    thresholds = {"t_plus_2": 0.0, "t_minus_2": 9.0}
    res = validate_thresholds("test", raw, thresholds)
    assert res["status"] == "well_calibrated"
    assert "Insufficient data" in res["message"]

def test_validate_thresholds_well_calibrated():
    # 100 points, normal distribution
    np.random.seed(42)
    raw = list(np.random.normal(loc=50.0, scale=10.0, size=100))
    p2_5 = np.percentile(raw, 2.5)
    p97_5 = np.percentile(raw, 97.5)
    
    # Configure well-calibrated thresholds (normal metric)
    thresholds = {"t_plus_2": float(p2_5), "t_minus_2": float(p97_5)}
    res = validate_thresholds("test", raw, thresholds)
    assert res["status"] == "well_calibrated"
    assert abs(res["suggested_t_plus_2"] - p2_5) < 1e-7
    assert abs(res["suggested_t_minus_2"] - p97_5) < 1e-7

def test_validate_thresholds_over_conservative():
    # 100 points from 0 to 10
    raw = [float(i) for i in range(100)]
    # Thresholds are way outside [0, 99]
    thresholds = {"t_plus_2": -100.0, "t_minus_2": 200.0}
    res = validate_thresholds("test", raw, thresholds)
    assert res["status"] == "over_conservative"
    assert "too extreme" in res["message"]

def test_validate_thresholds_under_conservative():
    # 100 points
    raw = [float(i) for i in range(100)]
    # Thresholds are very narrow (e.g. 40 and 60)
    thresholds = {"t_plus_2": 40.0, "t_minus_2": 60.0}
    res = validate_thresholds("test", raw, thresholds)
    assert res["status"] == "under_conservative"
    assert "too narrow" in res["message"]

def test_run_threshold_validation_db(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    init_db(db_file)
    
    metric_name = "test_metric"
    
    # Insert metric config
    conn = get_connection(db_file)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2) VALUES (?, ?, ?, ?, ?, ?)",
        (metric_name, 200.0, 150.0, 100.0, 50.0, -100.0) # normal metric, t_plus_2 = -100.0, t_minus_2 = 200.0
    )
    conn.commit()
    conn.close()
    
    # Insert 100 data points from 0 to 99
    for i in range(100):
        insert_metric(
            date=f"2026-05-{i+1:02d}" if i < 30 else f"2026-06-{i-29:02d}",
            metric_name=metric_name,
            raw_value=float(i),
            normalized_value=0.0,
            btc_price=60000.0,
            db_path=db_file
        )
        
    validations = run_threshold_validation(db_file)
    assert metric_name in validations
    res = validations[metric_name]
    assert res["status"] in ["over_conservative", "under_conservative", "well_calibrated"]
