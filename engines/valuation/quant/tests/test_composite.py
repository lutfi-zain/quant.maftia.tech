import pytest
import numpy as np
from quant.audit.composite import rescale, fit_rescaling_params
from database.db import init_db, insert_metric, get_connection

def test_rescale_fallback():
    # If no params, should return the input raw_value
    assert rescale(1.5, None) == 1.5
    assert rescale(1.5, {}) == 1.5
    assert rescale(1.5, {"raw_p2_5": -0.5}) == 1.5

def test_rescale_boundaries():
    params = {
        "raw_p2_5": -0.8,
        "raw_p50": 0.1,
        "raw_p97_5": 1.2
    }
    
    # Exact anchor points
    assert abs(rescale(-0.8, params) - (-2.0)) < 1e-7
    assert abs(rescale(0.1, params) - 0.0) < 1e-7
    assert abs(rescale(1.2, params) - 2.0) < 1e-7
    
    # Beyond anchor points (clamped)
    assert abs(rescale(-1.5, params) - (-2.0)) < 1e-7
    assert abs(rescale(2.0, params) - 2.0) < 1e-7

def test_rescale_interpolation():
    params = {
        "raw_p2_5": -1.0,
        "raw_p50": 0.0,
        "raw_p97_5": 1.0
    }
    
    # Midpoints
    assert abs(rescale(-0.5, params) - (-1.0)) < 1e-7
    assert abs(rescale(0.5, params) - 1.0) < 1e-7

def test_fit_rescaling_params_db(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    init_db(db_file)
    
    run_date = "2026-06-01"
    
    # Insert 10 different metrics to satisfy the component_count >= 10 constraint
    # Plus insert a mock metric with a huge value that is not in any cluster to verify how it is handled,
    # or just test with standard metrics. Let's insert a metric that we don't query in raw composites.
    # Wait, in the new cluster consolidation, any metric not in clusters is included.
    # If we want to verify that a metric is excluded or ignored, we can see if we should explicitly exclude
    # 'aviv_nupl' or other deprecated ones. But since aviv_nupl is now in the cost_basis cluster,
    # let's change this to use another name if we want to test exclusion, or simply not insert it to keep
    # the composite clean. Let's just not insert the huge aviv_nupl value.
    for i in range(100):
        date_str = f"2026-05-{i+1:02d}" if i < 30 else f"2026-06-{i-29:02d}"
        val = float(i) / 100.0 # goes from 0.0 to 0.99
        for m in range(1, 11):
            insert_metric(
                date=date_str,
                metric_name=f"m{m}",
                raw_value=val,
                normalized_value=val,
                btc_price=60000.0,
                db_path=db_file
            )
        
    params = fit_rescaling_params(db_file, run_date)
    assert "raw_p2_5" in params
    assert "raw_p50" in params
    assert "raw_p97_5" in params
    
    # Expected average excluding aviv_nupl is val, which ranges from 0.0 to 0.99
    conn = get_connection(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_composite_params WHERE run_date = ?", (run_date,))
    row = cursor.fetchone()
    assert row is not None
    assert abs(row["raw_min"] - 0.0) < 1e-7
    assert abs(row["raw_max"] - 0.99) < 1e-7
    conn.close()
