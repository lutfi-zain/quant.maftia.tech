import pytest
import math
import sqlite3
import os
from quant.components.normalization import normalize, load_thresholds, normalize_metric

def test_normalization_normal_metric():
    # AVIV Ratio-Z thresholds: t_plus_2=-2, t_plus_1=-1, t_minus_1=1, t_minus_2=2
    # +2 region (extreme undervaluation)
    assert normalize(-2.5, -2, -1, 1, 2) == pytest.approx(2.0)
    # between +2SD and +1SD
    assert normalize(-1.5, -2, -1, 1, 2) == pytest.approx(1.5)
    # exact +1SD threshold
    assert normalize(-1.0, -2, -1, 1, 2) == pytest.approx(1.0)
    # neutral zone midpoint
    assert normalize(0.0, -2, -1, 1, 2) == pytest.approx(0.0)
    # between -1SD and -2SD
    assert normalize(1.5, -2, -1, 1, 2) == pytest.approx(-1.5)
    # extreme overvaluation
    assert normalize(3.0, -2, -1, 1, 2) == pytest.approx(-2.0)

def test_normalization_mvrv_z():
    # MVRV-Z thresholds: t_plus_2=0.15, t_plus_1=0.17, t_minus_1=4.6, t_minus_2=6.65
    # Note that 0.16 is the midpoint between 0.15 and 0.17
    assert normalize(0.16, 0.15, 0.17, 4.6, 6.65) == pytest.approx(1.5)
    # 5.625 is the midpoint between 4.6 and 6.65
    assert normalize(5.625, 0.15, 0.17, 4.6, 6.65) == pytest.approx(-1.5)

def test_normalization_inverted_metric():
    # Terminal Price Ratio thresholds (inverted): t_plus_2=1, t_plus_1=0.75, t_minus_1=0.25, t_minus_2=0.17
    # above +2SD threshold, clamped
    assert normalize(1.2, 1, 0.75, 0.25, 0.17) == pytest.approx(2.0)
    # midpoint between +2SD and +1SD
    assert normalize(0.875, 1, 0.75, 0.25, 0.17) == pytest.approx(1.5)
    # midpoint between -1SD and -2SD
    assert normalize(0.21, 1, 0.75, 0.25, 0.17) == pytest.approx(-1.5)
    # below -2SD threshold, clamped
    assert normalize(0.10, 1, 0.75, 0.25, 0.17) == pytest.approx(-2.0)

def test_normalization_one_sided_bottom_only():
    # CVDD Ratio: t_plus_2=1.3, t_plus_1=1.6, t_minus_1=None, t_minus_2=None
    # below +2SD
    assert normalize(1.1, 1.3, 1.6, None, None) == pytest.approx(2.0)
    # between +2SD and +1SD
    assert normalize(1.45, 1.3, 1.6, None, None) == pytest.approx(1.5)
    # outside bottom zone
    assert math.isnan(normalize(2.5, 1.3, 1.6, None, None))

def test_normalization_one_sided_top_only():
    # Unrealized Sell Risk: t_plus_2=None, t_plus_1=None, t_minus_1=1.8, t_minus_2=2.2
    # above -2SD
    assert normalize(2.5, None, None, 1.8, 2.2) == pytest.approx(-2.0)
    # between -1SD and -2SD
    assert normalize(2.0, None, None, 1.8, 2.2) == pytest.approx(-1.5)
    # outside top zone
    assert math.isnan(normalize(1.0, None, None, 1.8, 2.2))

def test_normalization_edge_cases():
    # NaN raw value
    assert math.isnan(normalize(float('nan'), -2, -1, 1, 2))
    # None raw value
    assert math.isnan(normalize(None, -2, -1, 1, 2))
    # All thresholds None
    assert normalize(5.0, None, None, None, None) == pytest.approx(0.0)

def test_db_threshold_loading(tmp_path):
    db_file = str(tmp_path / "test_config.db")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE metric_config (
            metric_name TEXT PRIMARY KEY,
            t_minus_2 REAL,
            t_minus_1 REAL,
            t_zero REAL,
            t_plus_1 REAL,
            t_plus_2 REAL
        )
    ''')
    # Full metric
    cursor.execute('''
        INSERT INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ("mvrv_z", 6.65, 4.6, None, 0.17, 0.15))
    # One-sided bottom-only metric
    cursor.execute('''
        INSERT INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ("cvdd_ratio", None, None, None, 1.6, 1.3))
    conn.commit()
    conn.close()

    # Test load_thresholds for full metric
    mvrv_thresholds = load_thresholds(db_file, "mvrv_z")
    assert mvrv_thresholds == {
        "t_plus_2": 0.15,
        "t_plus_1": 0.17,
        "t_minus_1": 4.6,
        "t_minus_2": 6.65
    }

    # Test load_thresholds for bottom-only metric
    cvdd_thresholds = load_thresholds(db_file, "cvdd_ratio")
    assert cvdd_thresholds == {
        "t_plus_2": 1.3,
        "t_plus_1": 1.6,
        "t_minus_1": None,
        "t_minus_2": None
    }

    # Test nonexistent metric raises ValueError
    with pytest.raises(ValueError, match="Metric config not found for 'nonexistent_metric'"):
        load_thresholds(db_file, "nonexistent_metric")

    # Test normalize_metric end-to-end lookup and normalization
    # ahr999 (t_minus_2=5.47, t_minus_1=2.9, t_plus_1=0.7, t_plus_2=0.45)
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ("ahr999", 5.47, 2.9, None, 0.7, 0.45))
    conn.commit()
    conn.close()

    val = normalize_metric(db_file, "ahr999", 0.575)
    assert val == pytest.approx(1.5)
