import sqlite3
import numpy as np
from typing import Dict, Any, List, Tuple
from database.db import get_connection

def validate_thresholds(
    metric_name: str,
    raw_vals: List[float],
    thresholds: Dict[str, float | None]
) -> Dict[str, Any]:
    """
    Validates a metric's configured thresholds against the actual historical raw data.
    Returns status ('well_calibrated', 'over_conservative', 'under_conservative') and suggestions.
    """
    n = len(raw_vals)
    res = {
        "metric_name": metric_name,
        "status": "well_calibrated",
        "t_plus_2": thresholds.get("t_plus_2"),
        "t_minus_2": thresholds.get("t_minus_2"),
        "suggested_t_plus_2": None,
        "suggested_t_minus_2": None,
        "message": ""
    }
    
    if n < 30:
        res["status"] = "well_calibrated"
        res["message"] = "Insufficient data to validate thresholds."
        return res
        
    arr = np.array(raw_vals, dtype=float)
    
    # Check if inverted or normal
    t_plus_2 = thresholds.get("t_plus_2")
    t_minus_2 = thresholds.get("t_minus_2")
    
    if t_plus_2 is None and t_minus_2 is None:
        res["message"] = "No extreme thresholds configured."
        return res
        
    inverted = False
    if t_plus_2 is not None and t_minus_2 is not None:
        inverted = t_plus_2 > t_minus_2
    elif t_plus_2 is not None:
        # If only t_plus_2 (bottom-only), let's infer from t_plus_1 if available
        t_plus_1 = thresholds.get("t_plus_1")
        if t_plus_1 is not None:
            inverted = t_plus_2 > t_plus_1
    elif t_minus_2 is not None:
        t_minus_1 = thresholds.get("t_minus_1")
        if t_minus_1 is not None:
            inverted = t_minus_1 > t_minus_2
            
    # Calculate target percentiles
    p2_5 = float(np.percentile(arr, 2.5))
    p97_5 = float(np.percentile(arr, 97.5))
    
    # Generate suggestions
    if t_plus_2 is not None:
        res["suggested_t_plus_2"] = p97_5 if inverted else p2_5
    if t_minus_2 is not None:
        res["suggested_t_minus_2"] = p2_5 if inverted else p97_5
        
    # Analyze calibration
    # Let's count how many raw values actually exceed or fall below the thresholds.
    # For a normal metric: bottom maps to t_plus_2 (lower raw values <= t_plus_2 are +2)
    # top maps to t_minus_2 (higher raw values >= t_minus_2 are -2)
    # For an inverted metric: bottom maps to t_plus_2 (higher raw values >= t_plus_2 are +2)
    # top maps to t_minus_2 (lower raw values <= t_minus_2 are -2)
    
    pct_at_bottom = 0.0
    pct_at_top = 0.0
    
    if t_plus_2 is not None:
        if not inverted:
            pct_at_bottom = np.sum(arr <= t_plus_2) / n
        else:
            pct_at_bottom = np.sum(arr >= t_plus_2) / n
            
    if t_minus_2 is not None:
        if not inverted:
            pct_at_top = np.sum(arr >= t_minus_2) / n
        else:
            pct_at_top = np.sum(arr <= t_minus_2) / n
            
    # We define calibration status based on boundary coverage
    # - Over-conservative: actual saturation at bottom OR top is extremely low (e.g. 0% or < 0.2%)
    # - Under-conservative: actual saturation is too high (e.g. > 10%)
    # - Well-calibrated: saturation is within normal ranges (e.g. between 0.5% and 8.0%)
    
    is_over = False
    is_under = False
    
    # Determine flags based on thresholds present
    if t_plus_2 is not None:
        if pct_at_bottom < 0.002: # never or almost never reached
            is_over = True
        elif pct_at_bottom > 0.10: # saturated
            is_under = True
            
    if t_minus_2 is not None:
        if pct_at_top < 0.002:
            is_over = True
        elif pct_at_top > 0.10:
            is_under = True
            
    if is_over:
        res["status"] = "over_conservative"
        res["message"] = "Thresholds are too extreme and never/rarely reached in historical data."
    elif is_under:
        res["status"] = "under_conservative"
        res["message"] = "Thresholds are too narrow, causing excessive boundary saturation."
    else:
        res["status"] = "well_calibrated"
        res["message"] = "Thresholds are well-aligned with historical percentiles."
        
    return res

def run_threshold_validation(db_path: str) -> Dict[str, Dict[str, Any]]:
    """
    Runs threshold validation for all metrics in the database.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Get all metric configs
    cursor.execute("SELECT metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2 FROM metric_config")
    configs = cursor.fetchall()
    
    validations = {}
    
    for row in configs:
        metric = row[0]
        thresholds = {
            "t_minus_2": row[1],
            "t_minus_1": row[2],
            "t_zero": row[3],
            "t_plus_1": row[4],
            "t_plus_2": row[5]
        }
        
        # Get raw values
        cursor.execute("SELECT raw_value FROM timeseries_metrics WHERE metric_name = ? ORDER BY date ASC", (metric,))
        raw_vals = [r[0] for r in cursor.fetchall() if r[0] is not None]
        
        validations[metric] = validate_thresholds(metric, raw_vals, thresholds)
        
    conn.close()
    return validations
