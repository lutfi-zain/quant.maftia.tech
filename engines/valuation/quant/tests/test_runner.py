import pytest
from quant.audit.runner import run_audit, print_summary_report
from database.db import init_db, insert_metric, get_connection

def test_run_audit_full_flow(tmp_path):
    db_file = str(tmp_path / "test_metrics.db")
    init_db(db_file)
    
    # Insert 35 days of data for two metrics to avoid insufficient data warnings / errors
    for i in range(35):
        date_str = f"2026-05-{i+1:02d}"
        val1 = float(i)
        val2 = float(i * 2)
        insert_metric(
            date=date_str,
            metric_name="metric_a",
            raw_value=val1,
            normalized_value=val1 / 35.0 * 4.0 - 2.0,
            btc_price=60000.0,
            db_path=db_file
        )
        insert_metric(
            date=date_str,
            metric_name="metric_b",
            raw_value=val2,
            normalized_value=val2 / 70.0 * 4.0 - 2.0,
            btc_price=60000.0,
            db_path=db_file
        )
        
    # Run audit
    results = run_audit(db_file)
    
    # Verify dict structure
    assert "run_date" in results
    assert "indicator_stats" in results
    assert "threshold_validation" in results
    assert "correlations" in results
    assert "composite_params" in results
    
    assert "metric_a" in results["indicator_stats"]
    assert "metric_b" in results["indicator_stats"]
    
    assert results["indicator_stats"]["metric_a"]["count"] == 35
    assert results["indicator_stats"]["metric_a"]["data_insufficient"] is False
    
    # Try printing report
    print_summary_report(results)
