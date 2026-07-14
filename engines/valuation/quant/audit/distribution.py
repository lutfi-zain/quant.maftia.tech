import sqlite3
import numpy as np
import scipy.stats as stats
from typing import Dict, Any, List, Tuple
from database.db import get_connection

def compute_distribution_stats(normalized_values: List[float], raw_values: List[float]) -> Dict[str, Any]:
    """
    Computes distribution statistics for a metric's normalized and raw values.
    Returns a dict with all required stats and flags.
    """
    n = len(normalized_values)
    
    # Initialize default stats dictionary
    res = {
        "count": n,
        "mean": 0.0,
        "std": 0.0,
        "skewness": 0.0,
        "kurtosis": 0.0,
        "p2_5": 0.0,
        "p5": 0.0,
        "p25": 0.0,
        "p50": 0.0,
        "p75": 0.0,
        "p95": 0.0,
        "p97_5": 0.0,
        "min_val": 0.0,
        "max_val": 0.0,
        "pct_at_plus2": 0.0,
        "pct_at_minus2": 0.0,
        "data_insufficient": False
    }
    
    if n < 30:
        res["data_insufficient"] = True
        
    if n == 0:
        return res
        
    norm_arr = np.array(normalized_values, dtype=float)
    raw_arr = np.array(raw_values, dtype=float)
    
    # We analyze the distribution of the normalized_values as required by the spec
    res["mean"] = float(np.mean(norm_arr))
    res["min_val"] = float(np.min(norm_arr))
    res["max_val"] = float(np.max(norm_arr))
    
    if n > 1:
        res["std"] = float(np.std(norm_arr, ddof=1))
    else:
        res["std"] = 0.0
        
    # Skewness and Kurtosis (handle cases with n < 3 or standard deviation = 0)
    if n >= 3 and res["std"] > 0:
        res["skewness"] = float(stats.skew(norm_arr, bias=False))
        res["kurtosis"] = float(stats.kurtosis(norm_arr, bias=False))
    else:
        res["skewness"] = 0.0
        res["kurtosis"] = 0.0
        
    # Replace nan or inf in stats
    for k in ["skewness", "kurtosis"]:
        if np.isnan(res[k]) or np.isinf(res[k]):
            res[k] = 0.0
            
    # Percentiles
    percentiles = [2.5, 5, 25, 50, 75, 95, 97.5]
    pct_vals = np.percentile(norm_arr, percentiles)
    res["p2_5"] = float(pct_vals[0])
    res["p5"] = float(pct_vals[1])
    res["p25"] = float(pct_vals[2])
    res["p50"] = float(pct_vals[3])
    res["p75"] = float(pct_vals[4])
    res["p95"] = float(pct_vals[5])
    res["p97_5"] = float(pct_vals[6])
    
    # Percentage at boundaries (normalized_value >= 2.0 or <= -2.0)
    plus2_count = np.sum(norm_arr >= 2.0)
    minus2_count = np.sum(norm_arr <= -2.0)
    res["pct_at_plus2"] = float(plus2_count / n)
    res["pct_at_minus2"] = float(minus2_count / n)
    
    return res

def run_distribution_analysis(db_path: str, run_date: str) -> Dict[str, Dict[str, Any]]:
    """
    Runs distribution analysis for all metrics in the database.
    Saves results to audit_indicator_stats.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Get list of unique metric names
    cursor.execute("SELECT DISTINCT metric_name FROM timeseries_metrics")
    metrics = [row[0] for row in cursor.fetchall()]
    
    all_stats = {}
    
    for metric in metrics:
        # Query raw and normalized values
        cursor.execute(
            "SELECT raw_value, normalized_value FROM timeseries_metrics WHERE metric_name = ? ORDER BY date ASC",
            (metric,)
        )
        rows = cursor.fetchall()
        raw_vals = [r[0] for r in rows if r[0] is not None]
        norm_vals = [r[1] for r in rows if r[1] is not None]
        
        stats_dict = compute_distribution_stats(norm_vals, raw_vals)
        all_stats[metric] = stats_dict
        
        # Save to database (only if there are data points)
        if len(norm_vals) > 0:
            cursor.execute('''
                INSERT OR REPLACE INTO audit_indicator_stats (
                    metric_name, run_date, count, mean, std, skewness, kurtosis,
                    p2_5, p5, p25, p50, p75, p95, p97_5, min_val, max_val,
                    pct_at_plus2, pct_at_minus2
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metric,
                run_date,
                stats_dict["count"],
                stats_dict["mean"],
                stats_dict["std"],
                stats_dict["skewness"],
                stats_dict["kurtosis"],
                stats_dict["p2_5"],
                stats_dict["p5"],
                stats_dict["p25"],
                stats_dict["p50"],
                stats_dict["p75"],
                stats_dict["p95"],
                stats_dict["p97_5"],
                stats_dict["min_val"],
                stats_dict["max_val"],
                stats_dict["pct_at_plus2"],
                stats_dict["pct_at_minus2"]
            ))
            
    conn.commit()
    conn.close()
    
    return all_stats
