import sqlite3
import numpy as np
import scipy.stats as stats
from typing import Dict, Any, List, Tuple
from database.db import get_connection

def compute_pairwise_correlation(
    series_a: List[float],
    series_b: List[float]
) -> Tuple[float, float]:
    """
    Computes Pearson and Spearman correlation coefficients between two series.
    Returns (pearson, spearman).
    """
    if len(series_a) < 10 or len(series_b) < 10:
        return 0.0, 0.0
        
    arr_a = np.array(series_a, dtype=float)
    arr_b = np.array(series_b, dtype=float)
    
    # Check if either series is constant (std dev = 0)
    if np.std(arr_a) < 1e-9 or np.std(arr_b) < 1e-9:
        return 0.0, 0.0
        
    try:
        pearson_coef, _ = stats.pearsonr(arr_a, arr_b)
        if np.isnan(pearson_coef) or np.isinf(pearson_coef):
            pearson_coef = 0.0
    except Exception:
        pearson_coef = 0.0
        
    try:
        spearman_coef, _ = stats.spearmanr(arr_a, arr_b)
        if np.isnan(spearman_coef) or np.isinf(spearman_coef):
            spearman_coef = 0.0
    except Exception:
        spearman_coef = 0.0
        
    return float(pearson_coef), float(spearman_coef)

def run_correlation_analysis(db_path: str, run_date: str) -> List[Dict[str, Any]]:
    """
    Computes pairwise correlations for all metrics and stores them in the DB.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Query all metric values grouped by date
    cursor.execute('''
        SELECT date, metric_name, normalized_value 
        FROM timeseries_metrics 
        WHERE normalized_value IS NOT NULL
        ORDER BY date ASC
    ''')
    rows = cursor.fetchall()
    
    # Pivot logic: pivot_data[date][metric_name] = normalized_value
    pivot_data = {}
    metrics_set = set()
    for row in rows:
        date_str = row[0]
        metric = row[1]
        val = row[2]
        
        metrics_set.add(metric)
        if date_str not in pivot_data:
            pivot_data[date_str] = {}
        pivot_data[date_str][metric] = val
        
    metrics = sorted(list(metrics_set))
    results = []
    
    # Compute pairwise correlation
    for i in range(len(metrics)):
        for j in range(i + 1, len(metrics)):
            metric_a = metrics[i]
            metric_b = metrics[j]
            
            # Align dates
            aligned_a = []
            aligned_b = []
            for date_str in pivot_data:
                vals = pivot_data[date_str]
                if metric_a in vals and metric_b in vals:
                    aligned_a.append(vals[metric_a])
                    aligned_b.append(vals[metric_b])
                    
            pearson, spearman = compute_pairwise_correlation(aligned_a, aligned_b)
            
            is_high = abs(pearson) > 0.85 or abs(spearman) > 0.85
            
            res_entry = {
                "metric_a": metric_a,
                "metric_b": metric_b,
                "pearson": pearson,
                "spearman": spearman,
                "highly_correlated": is_high,
                "sample_size": len(aligned_a)
            }
            results.append(res_entry)
            
            # Save to database
            cursor.execute('''
                INSERT OR REPLACE INTO audit_correlation_matrix (
                    metric_a, metric_b, run_date, pearson, spearman
                ) VALUES (?, ?, ?, ?, ?)
            ''', (metric_a, metric_b, run_date, pearson, spearman))
            
    conn.commit()
    conn.close()
    
    return results
