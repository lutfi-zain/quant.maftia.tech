#!/usr/bin/env python3
"""
Validates that the DR-immune composite reaches expected extreme values at
all historical cycle tops (<= -1.0) and bottoms (>= +1.0).
Runs the full fetch -> normalize -> average -> rescale pipeline.
"""
import os, sys, json, sqlite3
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR) if os.path.basename(BASE_DIR) == 'scripts' else BASE_DIR
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

VALUATION_DIR = os.path.join(PROJECT_DIR, 'engines/valuation')
DB_METRICS = os.path.join(VALUATION_DIR, 'database/metrics.db')
DB_MAIN = os.path.join(PROJECT_DIR, 'data/maftia_quant.db')

# Historical cycle extremes
CYCLE_TOPS = {
    '2013 Peak': '2013-11-29',
    '2017 Peak': '2017-12-16',
    '2021 Peak-A': '2021-04-14',
    '2021 Peak-B': '2021-11-10',
    '2024 Peak': '2024-03-13',
    '2025 Peak': '2025-10-06',
}

CYCLE_BOTTOMS = {
    '2015 Bottom': '2015-01-14',
    '2018 Bottom': '2018-12-15',
    '2022 Bottom': '2022-11-21',
}

# The 7 active DR-immune indicators (cointime-adjusted + AVIV)
ACTIVE_INDICATORS = [
    'aviv_ratio', 'mvrv_z_cvsc', 'pi_cycle_top_cvsc', 'risk_metrics_cvsc',
    'two_year_ma_rcap', 'ahr999_cvsc', 'vpli_cvsc'
]

def load_composite():
    """Reads the current composite from maftia_quant.db."""
    from db_connector import get_wal_connection
    conn = get_wal_connection(DB_MAIN)
    rows = conn.execute("""
        SELECT date, valuation_composite FROM unified_daily_analytics
        WHERE valuation_composite IS NOT NULL
        ORDER BY date ASC
    """).fetchall()
    conn.close()
    return {r[0][:10]: r[1] for r in rows}

def compute_dr_immune_composite():
    """Computes the new DR-immune composite:
    1. Read normalized values for 9 active indicators from timeseries_metrics
    2. Average them
    3. Apply expanding-window percentile rescaling
    """
    from db_connector import get_wal_connection
    
    # Load indicator scores
    conn = get_wal_connection(DB_METRICS)
    placeholders = ','.join(['?'] * len(ACTIVE_INDICATORS))
    rows = conn.execute(f"""
        SELECT date, metric_name, normalized_value
        FROM timeseries_metrics
        WHERE metric_name IN ({placeholders})
          AND normalized_value IS NOT NULL
        ORDER BY date ASC
    """, ACTIVE_INDICATORS).fetchall()
    conn.close()
    
    if not rows:
        print("No data found. Run the pipeline first.")
        return None
    
    # Pivot
    df = pd.DataFrame(rows, columns=['date', 'metric_name', 'normalized_value'])
    pivot = df.pivot_table(index='date', columns='metric_name', values='normalized_value', aggfunc='first')
    pivot = pivot.dropna(thresh=6)  # min 6 indicators
    
    # Average
    pivot['raw_composite'] = pivot.mean(axis=1)
    
    # Expanding-window rescaling
    raw_vals = pivot['raw_composite'].values
    rescaled = []
    for i in range(len(raw_vals)):
        if i < 180:
            rescaled.append(raw_vals[i])
            continue
        hist = raw_vals[:i]
        p2_5 = float(np.percentile(hist, 2.5))
        p50 = float(np.percentile(hist, 50))
        p97_5 = float(np.percentile(hist, 97.5))
        v = raw_vals[i]
        if v <= p2_5:
            rescaled.append(-2.0)
        elif v >= p97_5:
            rescaled.append(2.0)
        elif v < p50:
            rescaled.append(-2.0 + 2.0 * (v - p2_5) / (p50 - p2_5) if p50 - p2_5 > 0 else 0.0)
        else:
            rescaled.append(0.0 + 2.0 * (v - p50) / (p97_5 - p50) if p97_5 - p50 > 0 else 0.0)
    
    return dict(zip(pivot.index, rescaled))

def main():
    print("=" * 80)
    print("DR-IMMUNE COMPOSITE VALIDATION")
    print("=" * 80)
    
    comp = compute_dr_immune_composite()
    if comp is None:
        print("Cannot compute DR-immune composite. No data.")
        return
    
    all_pass = True
    
    print("\n--- Cycle Tops (require <= -1.0) ---")
    for name, date_str in CYCLE_TOPS.items():
        scores = [v for d, v in comp.items() if d.startswith(date_str[:10])]
        if scores:
            val = max(scores)  # Less negative = closest to signal
            status = "PASS" if val <= -1.0 else "FAIL"
            if status == "FAIL":
                all_pass = False
            print(f"  {name:20s} ({date_str}): {val:+.2f} [{status}]")
        else:
            print(f"  {name:20s} ({date_str}): NO DATA [SKIP]")
    
    print("\n--- Cycle Bottoms (require >= +1.0) ---")
    for name, date_str in CYCLE_BOTTOMS.items():
        scores = [v for d, v in comp.items() if d.startswith(date_str[:10])]
        if scores:
            val = min(scores)  # Less positive = closest to signal
            status = "PASS" if val >= 1.0 else "FAIL"
            if status == "FAIL":
                all_pass = False
            print(f"  {name:20s} ({date_str}): {val:+.2f} [{status}]")
        else:
            print(f"  {name:20s} ({date_str}): NO DATA [SKIP]")
    
    print(f"\nOverall: {'ALL PASS' if all_pass else 'SOME FAILED'}")

if __name__ == '__main__':
    main()
