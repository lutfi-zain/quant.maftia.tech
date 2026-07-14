#!/usr/bin/env python3
"""
Regime Detector — On-Chain & Sentiment Regime Classification
============================================================

Loads 17 metrics from the BTC Valuation System database, normalizes them
to a -2 to +2 scale (already done in the database), and computes a
composite regime signal based on majority vote.

Regime Logic:
- Bull:  Majority of metrics have normalized_value > 0.5
- Bear:  Majority of metrics have normalized_value < -0.5
- Neutral: Otherwise

Output: mttd/regime_data.csv with columns: date, regime, composite_score
"""

import os
import sys
import sqlite3
import pandas as pd
import numpy as np
from pathlib import Path

# ================================================================
# Configuration
# ================================================================
VALUATION_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'valuation/database/metrics.db')
MTTD_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mttd')
OUTPUT_FILE = os.path.join(MTTD_OUTPUT_DIR, 'regime_data.csv')

# MTTD system starts from 2018-01-01
MTTD_START_DATE = '2018-01-01'

# Thresholds for regime classification
BULL_THRESHOLD = 0.5
BEAR_THRESHOLD = -0.5

# Minimum number of metrics required for a valid regime classification
MIN_METRICS_REQUIRED = 10

# ================================================================
# Importable API (Task 2B.1)
# ================================================================

def load_regime_series(csv_path=OUTPUT_FILE):
    """
    Load precomputed regime CSV into a pandas Series mapped by datetime index.
    Returns numeric multiplier: Bull=1.0, Neutral=0.5, Bear=0.0.
    """
    if not os.path.exists(csv_path):
        return pd.Series(dtype=float)
    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    regime_map = {'Bull': 1.0, 'Neutral': 0.5, 'Bear': 0.0}
    s = df.set_index('date')['regime'].map(regime_map)
    return s

_CACHED_REGIME_SERIES = None

def get_regime_signal(date_val) -> float:
    """
    Get numeric regime signal (1.0 bull, 0.5 neutral, 0.0 bear) for a given date.
    Returns: 1.0 (bull), 0.5 (neutral/transition), 0.0 (bear/dist).
    """
    global _CACHED_REGIME_SERIES
    if _CACHED_REGIME_SERIES is None:
        _CACHED_REGIME_SERIES = load_regime_series()
    dt = pd.to_datetime(date_val).normalize()
    if dt in _CACHED_REGIME_SERIES.index:
        return float(_CACHED_REGIME_SERIES.loc[dt])
    return 1.0  # Default to 1.0 if missing

def compute_regime(row, bull_thresh=BULL_THRESHOLD, bear_thresh=BEAR_THRESHOLD, min_metrics=MIN_METRICS_REQUIRED):
    """
    Compute regime for a single date based on majority vote.
    
    Rules:
    - Bull:  majority of metrics > bull_thresh
    - Bear:  majority of metrics < bear_thresh
    - Neutral: otherwise
    
    Returns: (regime_label, composite_score)
    """
    valid_metrics = row.dropna()
    n_valid = len(valid_metrics)
    
    if n_valid < min_metrics:
        return ('Neutral', 0.0)
    
    # Count bullish and bearish signals
    n_bull = (valid_metrics > bull_thresh).sum()
    n_bear = (valid_metrics < bear_thresh).sum()
    n_neutral = n_valid - n_bull - n_bear
    
    # Majority threshold
    majority = n_valid / 2.0
    
    # Composite score: weighted average normalized to -1 to +1
    composite_score = valid_metrics.mean()
    
    # Determine regime
    if n_bull > majority:
        regime = 'Bull'
    elif n_bear > majority:
        regime = 'Bear'
    else:
        regime = 'Neutral'
    
    return (regime, round(composite_score, 4))


def generate_regime_data():
    """Run pipeline to load database metrics, compute regimes, and export CSV."""
    print("=" * 70)
    print("REGIME DETECTOR — On-Chain & Sentiment Regime Classification")
    print("=" * 70)

    print("\n[1/4] Loading metrics from valuation database...")
    import sys
    if "/home/ubuntu/projects" not in sys.path:
        sys.path.insert(0, "/home/ubuntu/projects")
    from db_connector import get_wal_connection
    conn = get_wal_connection(VALUATION_DB_PATH)
    df = pd.read_sql('''
        SELECT date, metric_name, normalized_value 
        FROM timeseries_metrics 
        WHERE normalized_value IS NOT NULL
    ''', conn)
    conn.close()

    print(f"  Loaded {len(df)} rows across {df['metric_name'].nunique()} metrics")
    print(f"  Date range: {df['date'].min()} to {df['date'].max()}")

    print("\n[2/4] Pivoting and aligning data...")
    pivot = df.pivot_table(
        index='date', 
        columns='metric_name', 
        values='normalized_value', 
        aggfunc='first'
    )
    pivot.index = pd.to_datetime(pivot.index).tz_localize(None)
    pivot = pivot[pivot.index >= MTTD_START_DATE]

    print(f"  Pivoted data: {len(pivot)} dates, {len(pivot.columns)} metrics")

    print("\n[3/4] Computing regime signal using majority vote...")
    results = pivot.apply(
        lambda row: compute_regime(row, BULL_THRESHOLD, BEAR_THRESHOLD, MIN_METRICS_REQUIRED), 
        axis=1, 
        result_type='expand'
    )
    results.columns = ['regime', 'composite_score']

    regime_df = pd.DataFrame({
        'date': results.index,
        'regime': results['regime'].values,
        'composite_score': results['composite_score'].values
    })

    print("\n  Regime Distribution:")
    regime_counts = regime_df['regime'].value_counts()
    for regime in ['Bull', 'Neutral', 'Bear']:
        count = regime_counts.get(regime, 0)
        pct = count / len(regime_df) * 100
        print(f"    {regime:10s}: {count:5d} ({pct:5.1f}%)")

    print("\n[4/4] Saving regime data...")
    os.makedirs(MTTD_OUTPUT_DIR, exist_ok=True)
    regime_df.to_csv(OUTPUT_FILE, index=False)
    print(f"  Saved: {OUTPUT_FILE}")
    return regime_df

if __name__ == '__main__':
    generate_regime_data()
