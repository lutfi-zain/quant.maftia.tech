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
    Computes raw composite values (with Pearson cluster consolidation), fits percentile-based rescaling parameters,
    and stores them in the audit_composite_params table.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Query all individual normalized metrics
    cursor.execute('''
        SELECT date, metric_name, normalized_value
        FROM timeseries_metrics
        WHERE normalized_value IS NOT NULL
        ORDER BY date ASC
    ''')
    rows = cursor.fetchall()

    if not rows:
        conn.close()
        return {}

    # Group by date in Python
    from collections import defaultdict
    date_metrics = defaultdict(dict)
    for r in rows:
        date_metrics[r[0]][r[1]] = r[2]

    metric_clusters = {
        'cost_basis': ['aviv_nupl', 'aviv_ratio', 'mvrv_z'],
        'trend_ma': ['cvdd_ratio', 'two_year_ma', 'terminal_price_ratio', 'unrealized_sell_risk'],
        'sentiment': ['fear_greed_cmc', 'fear_greed_og']
    }

    raw_composites = []
    for dt in sorted(date_metrics.keys()):
        metrics_dict = date_metrics[dt]
        # Only fit parameters if the day has at least 10 active components
        if len(metrics_dict) >= 10:
            cluster_scores = []
            used_metrics = set()
            for cluster_name, metric_names in metric_clusters.items():
                vals = [metrics_dict[m] for m in metric_names if m in metrics_dict]
                if vals:
                    cluster_scores.append(sum(vals) / len(vals))
                    used_metrics.update(metric_names)
            for m, val in metrics_dict.items():
                if m not in used_metrics:
                    cluster_scores.append(val)
            if cluster_scores:
                raw_composites.append(sum(cluster_scores) / len(cluster_scores))

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
