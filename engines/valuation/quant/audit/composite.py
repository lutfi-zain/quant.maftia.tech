import sqlite3
import numpy as np
from typing import Dict, Any, List, Optional
from database.db import get_connection

def rescale(raw_value: float, params: Optional[Dict[str, Any]]) -> float:
    """
    Rescales a raw composite oscillator value to [-2, +2] using piecewise linear interpolation
    based on fitted percentile parameters. Falls back to raw_value if params is None or incomplete.
    """
    if raw_value is None or np.isnan(raw_value):
        return float('nan')
        
    if not params:
        return raw_value
        
    p2_5 = params.get("raw_p2_5")
    p50 = params.get("raw_p50")
    p97_5 = params.get("raw_p97_5")
    
    if p2_5 is None or p50 is None or p97_5 is None:
        return raw_value
        
    # Piecewise linear interpolation
    if raw_value <= p2_5:
        return -2.0
    elif raw_value >= p97_5:
        return 2.0
    elif raw_value < p50:
        denom = p50 - p2_5
        if abs(denom) < 1e-9:
            return -2.0
        return -2.0 + 2.0 * (raw_value - p2_5) / denom
    else:
        denom = p97_5 - p50
        if abs(denom) < 1e-9:
            return 2.0
        return 0.0 + 2.0 * (raw_value - p50) / denom

def fit_rescaling_params(db_path: str, run_date: str) -> Dict[str, Any]:
    """
    Computes raw composite values (simple average), fits percentile-based rescaling parameters,
    and stores them in the audit_composite_params table.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Compute raw composite AVG(normalized_value) grouped by date, excluding aviv_nupl, williams_r, fear_greed_cmc
    cursor.execute('''
        SELECT date, AVG(normalized_value) as raw_composite
        FROM timeseries_metrics
        WHERE normalized_value IS NOT NULL
          AND metric_name NOT IN ('aviv_nupl', 'williams_r', 'fear_greed_cmc')
        GROUP BY date
        HAVING COUNT(normalized_value) >= 10
        ORDER BY date ASC
    ''')
    rows = cursor.fetchall()

    if not rows:
        conn.close()
        return {}

    raw_composites = [row[1] for row in rows if row[1] is not None]

    if not raw_composites:
        conn.close()
        return {}
        
    arr = np.array(raw_composites, dtype=float)
    
    raw_min = float(np.min(arr))
    raw_max = float(np.max(arr))
    p2_5 = float(np.percentile(arr, 2.5))
    p50 = float(np.percentile(arr, 50))
    p97_5 = float(np.percentile(arr, 97.5))
    
    params = {
        "raw_min": raw_min,
        "raw_max": raw_max,
        "raw_p2_5": p2_5,
        "raw_p50": p50,
        "raw_p97_5": p97_5,
        "rescale_method": "percentile_piecewise"
    }
    
    # Save parameters to DB
    cursor.execute('''
        INSERT OR REPLACE INTO audit_composite_params (
            run_date, raw_min, raw_max, raw_p2_5, raw_p50, raw_p97_5, rescale_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        run_date,
        raw_min,
        raw_max,
        p2_5,
        p50,
        p97_5,
        params["rescale_method"]
    ))
    
    conn.commit()
    conn.close()
    
    return params
