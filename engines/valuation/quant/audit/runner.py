import argparse
import sys
from datetime import datetime
from typing import Dict, Any
from quant.audit.distribution import run_distribution_analysis
from quant.audit.threshold import run_threshold_validation
from quant.audit.correlation import run_correlation_analysis
from quant.audit.composite import fit_rescaling_params

def run_audit(db_path: str = "database/metrics.db") -> Dict[str, Any]:
    """
    Orchestrates the full statistical audit pipeline.
    """
    run_date = datetime.now().strftime('%Y-%m-%d')
    
    # 1. Distribution Analysis
    dist_stats = run_distribution_analysis(db_path, run_date)
    
    # 2. Threshold Validation
    threshold_vals = run_threshold_validation(db_path)
    
    # 3. Correlation Analysis
    correlations = run_correlation_analysis(db_path, run_date)
    
    # 4. Composite Parameter Fitting
    composite_params = fit_rescaling_params(db_path, run_date)
    
    return {
        "run_date": run_date,
        "indicator_stats": dist_stats,
        "threshold_validation": threshold_vals,
        "correlations": correlations,
        "composite_params": composite_params
    }

def print_summary_report(results: Dict[str, Any]) -> None:
    """
    Prints a formatted summary report of the statistical audit.
    """
    print("\n" + "=" * 90)
    print(f"{'QUANTITATIVE SYSTEM STATISTICAL AUDIT REPORT':^90}")
    run_date_str = f"Run Date: {results['run_date']}"
    print(f"{run_date_str:^90}")
    print("=" * 90)
    
    # 1. Indicator Stats and Thresholds
    print("\n--- 1. Indicator Distribution & Calibration Status ---")
    print(f"{'Indicator Name':<25} | {'Count':<6} | {'Mean':<6} | {'Std':<6} | {'% At -2':<8} | {'% At +2':<8} | {'Status':<18}")
    print("-" * 90)
    
    for metric, stats in results["indicator_stats"].items():
        val = results["threshold_validation"].get(metric, {})
        status = val.get("status", "unknown").upper()
        
        count = stats.get("count", 0)
        mean = stats.get("mean", 0.0)
        std = stats.get("std", 0.0)
        pct_minus2 = stats.get("pct_at_minus2", 0.0) * 100
        pct_plus2 = stats.get("pct_at_plus2", 0.0) * 100
        
        print(f"{metric:<25} | {count:<6} | {mean:<6.2f} | {std:<6.2f} | {pct_minus2:<7.1f}% | {pct_plus2:<7.1f}% | {status:<18}")
        
    # 2. Correlations
    print("\n--- 2. Highly Correlated Indicator Pairs (|r| > 0.85) ---")
    print(f"{'Metric A':<30} | {'Metric B':<30} | {'Pearson r':<10} | {'Spearman r':<10}")
    print("-" * 90)
    
    high_corrs = [c for c in results["correlations"] if c["highly_correlated"]]
    if not high_corrs:
        print(f"{'No highly correlated pairs detected. Good signal diversity!':^90}")
    else:
        for c in high_corrs:
            print(f"{c['metric_a']:<30} | {c['metric_b']:<30} | {c['pearson']:<10.3f} | {c['spearman']:<10.3f}")
            
    # 3. Composite Rescaling Parameters
    print("\n--- 3. Fitted Composite Rescaling Parameters ---")
    params = results["composite_params"]
    if not params:
        print("No composite parameters fitted.")
    else:
        print(f"Rescale Method:  {params.get('rescale_method')}")
        print(f"Historical Min:  {params.get('raw_min'):.4f}")
        print(f"Historical Max:  {params.get('raw_max'):.4f}")
        print(f"Anchor p2.5 (-2):{params.get('raw_p2_5'):.4f}")
        print(f"Anchor p50 (0):  {params.get('raw_p50'):.4f}")
        print(f"Anchor p97.5 (+2):{params.get('raw_p97_5'):.4f}")
        
    print("=" * 90 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run statistical audit pipeline")
    parser.add_argument("--db-path", default="database/metrics.db", help="Path to the SQLite database file")
    args = parser.parse_args()
    
    try:
        results = run_audit(args.db_path)
        print_summary_report(results)
        sys.exit(0)
    except Exception as e:
        print(f"Error running statistical audit: {type(e).__name__}: {str(e)}", file=sys.stderr)
        sys.exit(1)
