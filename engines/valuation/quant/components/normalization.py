import math
import sqlite3

def safe_div(num: float, denom: float) -> float:
    """Helper to perform division safely and avoid ZeroDivisionError."""
    return num / denom if abs(denom) > 1e-9 else 0.0

def normalize(raw_value: float, t_plus_2: float | None, t_plus_1: float | None, t_minus_1: float | None, t_minus_2: float | None) -> float:
    """
    Normalizes a raw metric value to a [-2, +2] scale using piecewise linear interpolation.
    
    Auto-detects normal/inverted/one-sided metrics from threshold values.
    Returns NaN for NaN or None raw_values.
    """
    if raw_value is None or (isinstance(raw_value, float) and math.isnan(raw_value)):
        return float('nan')
        
    if t_plus_2 is None and t_plus_1 is None and t_minus_1 is None and t_minus_2 is None:
        return 0.0

    # Auto-detect direction
    inverted = False
    if t_plus_2 is not None and t_minus_2 is not None:
        inverted = t_plus_2 > t_minus_2
    elif t_plus_2 is not None and t_plus_1 is not None:
        inverted = t_plus_2 > t_plus_1
    elif t_minus_1 is not None and t_minus_2 is not None:
        inverted = t_minus_1 > t_minus_2

    is_bottom_only = (t_minus_1 is None) and (t_minus_2 is None)
    is_top_only = (t_plus_1 is None) and (t_plus_2 is None)

    if is_bottom_only:
        if t_plus_2 is None or t_plus_1 is None:
            return 0.0
            
        if not inverted:
            # Normal direction (lower raw value = higher valuation/bottom = +2)
            if raw_value <= t_plus_2:
                return 2.0
            elif raw_value >= t_plus_1:
                return float('nan')
            else:
                return 2.0 - safe_div(raw_value - t_plus_2, t_plus_1 - t_plus_2)
        else:
            # Inverted direction (higher raw value = higher valuation/bottom = +2)
            if raw_value >= t_plus_2:
                return 2.0
            elif raw_value <= t_plus_1:
                return float('nan')
            else:
                return 1.0 + safe_div(raw_value - t_plus_1, t_plus_2 - t_plus_1)

    elif is_top_only:
        if t_minus_1 is None or t_minus_2 is None:
            return 0.0
            
        if not inverted:
            # Normal direction (higher raw value = lower valuation/top = -2)
            if raw_value >= t_minus_2:
                return -2.0
            elif raw_value <= t_minus_1:
                return float('nan')
            else:
                return -1.0 - safe_div(raw_value - t_minus_1, t_minus_2 - t_minus_1)
        else:
            # Inverted direction (lower raw value = lower valuation/top = -2)
            if raw_value <= t_minus_2:
                return -2.0
            elif raw_value >= t_minus_1:
                return float('nan')
            else:
                return -2.0 + safe_div(raw_value - t_minus_2, t_minus_1 - t_minus_2)

    else:
        if t_plus_2 is None or t_plus_1 is None or t_minus_1 is None or t_minus_2 is None:
            return 0.0
            
        if not inverted:
            # Normal direction
            if raw_value <= t_plus_2:
                return 2.0
            elif raw_value >= t_minus_2:
                return -2.0
            elif t_plus_2 <= raw_value < t_plus_1:
                return 2.0 - safe_div(raw_value - t_plus_2, t_plus_1 - t_plus_2)
            elif t_plus_1 <= raw_value < t_minus_1:
                return 1.0 - 2.0 * safe_div(raw_value - t_plus_1, t_minus_1 - t_plus_1)
            else:
                return -1.0 - safe_div(raw_value - t_minus_1, t_minus_2 - t_minus_1)
        else:
            # Inverted direction
            if raw_value >= t_plus_2:
                return 2.0
            elif raw_value <= t_minus_2:
                return -2.0
            elif t_plus_1 < raw_value <= t_plus_2:
                return 1.0 + safe_div(raw_value - t_plus_1, t_plus_2 - t_plus_1)
            elif t_minus_1 < raw_value <= t_plus_1:
                return -1.0 + 2.0 * safe_div(raw_value - t_minus_1, t_plus_1 - t_minus_1)
            else:
                return -2.0 + safe_div(raw_value - t_minus_2, t_minus_1 - t_minus_2)

def load_thresholds(db_path: str, metric_name: str) -> dict:
    """Loads threshold configuration for a metric from SQLite database."""
    import sys
    if "/home/ubuntu/projects" not in sys.path:
        sys.path.insert(0, "/home/ubuntu/projects")
    from db_connector import get_wal_connection
    conn = get_wal_connection(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT t_plus_2, t_plus_1, t_minus_1, t_minus_2 
            FROM metric_config 
            WHERE metric_name = ?
        ''', (metric_name,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Metric config not found for '{metric_name}'")
        
        t_plus_2, t_plus_1, t_minus_1, t_minus_2 = row
        return {
            "t_plus_2": t_plus_2,
            "t_plus_1": t_plus_1,
            "t_minus_1": t_minus_1,
            "t_minus_2": t_minus_2
        }
    finally:
        conn.close()

def normalize_metric(db_path: str, metric_name: str, raw_value: float) -> float:
    """Loads metric thresholds and normalizes a raw value in one step."""
    thresholds = load_thresholds(db_path, metric_name)
    return normalize(
        raw_value,
        thresholds["t_plus_2"],
        thresholds["t_plus_1"],
        thresholds["t_minus_1"],
        thresholds["t_minus_2"]
    )
