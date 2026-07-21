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

_vol_ratio_cache = {}

def load_vol_ratios(db_path: str):
    """Computes rolling 1-year price volatility causally and caches vol ratios."""
    global _vol_ratio_cache
    if _vol_ratio_cache:
        return
    try:
        import pandas as pd
        import numpy as np
        conn = sqlite3.connect(db_path)
        try:
            df = pd.read_sql("SELECT date, close FROM btc_ohlc ORDER BY date ASC", conn)
            if len(df) >= 365:
                df['log_ret'] = np.log(df['close'] / df['close'].shift(1))
                df['vol_1y'] = df['log_ret'].rolling(365).std() * np.sqrt(365)
                # Causal: shift by 1 day so today's calculation only uses historical data up to t-1
                df['vol_1y_causal'] = df['vol_1y'].shift(1)
                # Vol ratio = vol_1y / 0.80, clamped between 0.4 and 1.5
                df['vol_ratio'] = (df['vol_1y_causal'] / 0.80).clip(0.4, 1.5)
                df['vol_ratio'] = df['vol_ratio'].fillna(1.0)
                # Cache mapping date YYYY-MM-DD to vol ratio
                df['date_str'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                _vol_ratio_cache = dict(zip(df['date_str'], df['vol_ratio']))
        finally:
            conn.close()
    except Exception:
        pass

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

def normalize_metric(db_path: str, metric_name: str, raw_value: float, date: str | None = None) -> float:
    """Loads metric thresholds and normalizes a raw value in one step, with optional volatility adjustments."""
    thresholds = load_thresholds(db_path, metric_name)

    t_plus_2 = thresholds["t_plus_2"]
    t_plus_1 = thresholds["t_plus_1"]
    t_minus_1 = thresholds["t_minus_1"]
    t_minus_2 = thresholds["t_minus_2"]

    if date and metric_name in ("mvrv_z", "aviv_ratio", "aviv_nupl"):
        global _vol_ratio_cache
        if not _vol_ratio_cache:
            load_vol_ratios(db_path)
        try:
            import pandas as pd
            date_str = pd.to_datetime(date).strftime('%Y-%m-%d')
            vol_ratio = _vol_ratio_cache.get(date_str, 1.0)
        except Exception:
            vol_ratio = 1.0

        if t_minus_1 is not None:
            t_minus_1 = t_minus_1 * vol_ratio
        if t_minus_2 is not None:
            t_minus_2 = t_minus_2 * vol_ratio

    return normalize(
        raw_value,
        t_plus_2,
        t_plus_1,
        t_minus_1,
        t_minus_2
    )
