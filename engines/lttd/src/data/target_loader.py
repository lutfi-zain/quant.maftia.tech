import numpy as np
import pandas as pd
from pathlib import Path
from src.data.pipeline import ohlcv_pipeline

def compute_forward_returns_target(close_series: pd.Series, fwd_days: int = 60) -> pd.Series:
    """
    Computes 60-day forward log return (macro quarters hold), z-score normalized using a rolling 252-day window,
    and clipped to [-1, +1]. Matches LTTD macro horizon (60-90d).
    """
    # 60-day forward log return: log(close[t+fwd_days] / close[t])
    log_close = np.log(close_series)
    fwd_ret = log_close.shift(-fwd_days) - log_close
    
    # Rolling 252-day window volatility normalization (NO mean subtraction!)
    rolling_std = fwd_ret.rolling(window=252, min_periods=120).std()
    
    # Prevent division by zero/NaN in rolling std
    rolling_std_clean = rolling_std.replace(0.0, np.nan)
    
    zscore = fwd_ret / rolling_std_clean
    zscore = zscore.fillna(0.0)
    
    # Clip to [-1.0, 1.0]
    target = zscore.clip(-1.0, 1.0)
    
    # Macro Trend Filter: Suppress dead cat bounces in structural bear markets
    sma200 = close_series.rolling(window=200).mean()
    macro_bear_mask = close_series < sma200
    
    # If structural bear, clamp positive forward returns to 0
    # This teaches the model that bounce rallies in a macro bear are not profitable buy signals
    target.loc[macro_bear_mask & (target > 0)] = 0.0
    
    # Explicitly ensure target for date t is NaN if t+fwd_days is not in the close_series index
    if len(target) >= fwd_days:
        target.iloc[-fwd_days:] = np.nan
    else:
        target.iloc[:] = np.nan
            
    return target

def load_regime_targets(index: pd.DatetimeIndex, close_series: pd.Series = None) -> pd.Series:
    """
    Computes and loads forward returns targets aligned to the provided index.
    """
    if close_series is None:
        df_ohlcv = ohlcv_pipeline()
        close_series = df_ohlcv["close"]

    # Ensure index is standardized timezone wise
    if close_series.index.tz is None and index.tz is not None:
        close_series.index = close_series.index.tz_localize("UTC")
    elif close_series.index.tz is not None and index.tz is None:
        close_series.index = close_series.index.tz_localize(None)

    # Compute targets on the close series
    targets = compute_forward_returns_target(close_series)
    
    # Align to the requested index
    aligned_targets = targets.reindex(index)
    
    # Forward fill to handle alignment bounds up to last 60 rows
    if len(aligned_targets) > 60:
        non_nan_part = aligned_targets.iloc[:-60].ffill()
        aligned_targets.iloc[:-60] = non_nan_part
    return aligned_targets

def validate_target_alignment(y: pd.Series, X: pd.DataFrame, fwd_days: int = 60) -> None:
    """
    Validates that the target series y perfectly aligns with feature dataframe X.
    NaNs are permitted in the last fwd_days rows of y (freshness warmup).
    """
    if not y.index.equals(X.index):
        raise ValueError("Target index does not match Feature index. Misalignment detected.")
        
    # Check for NaNs except in the last fwd_days rows of the dataset
    if len(y) > fwd_days:
        non_fresh_y = y.iloc[:-fwd_days]
        if non_fresh_y.isnull().any():
            raise ValueError("Target series contains NaN values (gaps) in historical period.")
    else:
        pass
