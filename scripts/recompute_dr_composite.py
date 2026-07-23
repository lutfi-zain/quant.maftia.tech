#!/usr/bin/env python3
"""
Recomputes the DR-immune Valuation Composite for all historical dates
and updates unified_daily_analytics in maftia_quant.db.
Uses only the 7 active cointime-adjusted indicators.
"""
import os, sys, sqlite3
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if "/home/ubuntu/projects" not in sys.path:
    sys.path.insert(0, "/home/ubuntu/projects")
from db_connector import get_wal_connection

# Use absolute paths from project root
PROJECT_ROOT = '/home/ubuntu/projects/quant.maftia.tech'
VALUATION_DB = os.path.join(PROJECT_ROOT, 'engines/valuation/database/metrics.db')
MAIN_DB = os.path.join(PROJECT_ROOT, 'data/maftia_quant.db')

# The 7 active DR-immune indicators
ACTIVE_INDICATORS = [
    'aviv_ratio', 'mvrv_z_cvsc', 'pi_cycle_top_cvsc', 'risk_metrics_cvsc',
    'two_year_ma_rcap', 'ahr999_cvsc', 'vpli_cvsc'
]

def fetch_cvsc():
    """Fetches CVSC for multiplier computation."""
    from engines.valuation.quant.components.bitview_client import fetch_series
    df = fetch_series('cointime_value_stored_cumulative')
    if not df.empty:
        df['date_dt'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        return dict(zip(df['date_dt'], df['value']))
    return {}

def compute_dr_composite():
    print("=== Recomputing DR-Immune Composite ===")
    
    # Load indicator normalized values from metrics.db
    conn = get_wal_connection(VALUATION_DB)
    placeholders = ','.join(['?'] * len(ACTIVE_INDICATORS))
    rows = conn.execute(f"""
        SELECT date, metric_name, normalized_value, btc_price
        FROM timeseries_metrics
        WHERE metric_name IN ({placeholders})
          AND normalized_value IS NOT NULL
        ORDER BY date ASC
    """, ACTIVE_INDICATORS).fetchall()
    conn.close()
    
    print(f"Loaded {len(rows)} rows from {VALUATION_DB}")
    
    if not rows:
        print("No data found!")
        return None, None
    
    # Pivot
    df = pd.DataFrame(rows, columns=['date', 'metric_name', 'normalized_value', 'btc_price'])
    df['date_norm'] = df['date'].str[:10]
    
    pivot = df.pivot_table(index='date_norm', columns='metric_name', values='normalized_value', aggfunc='first')
    price_df = df.groupby('date_norm')['btc_price'].max()
    
    # Filter: require at least 5 indicators
    pivot = pivot.dropna(thresh=5)
    print(f"Dates with >=5 indicators: {len(pivot)}")
    
    # Average
    pivot['raw_composite'] = pivot.mean(axis=1)
    
    # Expanding-window percentile rescaling
    raw_vals = pivot['raw_composite'].values
    dates = pivot.index.values
    rescaled = []
    rescaled_dict = {}
    
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
            r = -2.0
        elif v >= p97_5:
            r = 2.0
        elif v < p50:
            denom = p50 - p2_5
            r = -2.0 + 2.0 * (v - p2_5) / denom if denom > 0 else 0.0
        else:
            denom = p97_5 - p50
            r = 0.0 + 2.0 * (v - p50) / denom if denom > 0 else 0.0
        rescaled.append(r)
    
    pivot['dr_composite'] = rescaled
    
    # Update unified_daily_analytics
    main_conn = get_wal_connection(MAIN_DB)
    
    updated = 0
    for date_norm in pivot.index:
        dr_val = float(pivot.loc[date_norm, 'dr_composite'])
        price = float(price_df.get(date_norm, 0))
        
        if pd.isna(dr_val):
            continue
        
        # Update existing or insert new
        main_conn.execute("""
            UPDATE unified_daily_analytics 
            SET valuation_composite = ?, btc_price = ?
            WHERE date LIKE ?
        """, (dr_val, price, date_norm + '%'))
        
        if main_conn.total_changes > updated:
            updated = main_conn.total_changes
    
    main_conn.commit()
    main_conn.close()
    
    print(f"Updated {updated} rows in unified_daily_analytics")
    
    # Check 2025 peak
    pivot.index = pd.to_datetime(pivot.index)
    oct_scores = pivot.loc['2025-10-01':'2025-10-10', 'dr_composite']
    if not oct_scores.empty:
        print(f"\n2025 Oct peak DR composite: {oct_scores.max():+.3f}")
    
    return pivot, rescaled_dict

if __name__ == '__main__':
    compute_dr_composite()
