import numpy as np
import pandas as pd
from typing import Optional, Tuple

# Sizing parameters — HL-driven LTTD (HL≈200d) with LTTD_MODE flag support ("macro" | "weeks")
import os
LTTD_MODE = os.environ.get("LTTD_MODE", "macro").lower()
HL = 200  # OU half-life proxy

if LTTD_MODE == "weeks":
    # v2.1 LTTD-M (weeks hold ~44d, ~2.57/yr)
    SUPERSMOOTHER_PERIOD_ENTRY = 14
    SUPERSMOOTHER_PERIOD_EXIT = 10
    SCORE_ENTRY = 0.28
    SCORE_EXIT = 0.22
    SCORE_ENTRY_Q = 0.65
    SCORE_EXIT_Q = 0.35
    RCO_DAYS = 14
    MHP_DAYS = 25
    MA_PERIOD = 226
else:
    # v3.0 LTTD-L (macro hold ~60-90d, ~1.60/yr)
    SUPERSMOOTHER_PERIOD_ENTRY = int(HL * 0.175) # 35
    SUPERSMOOTHER_PERIOD_EXIT = int(HL * 0.10)   # 20
    SCORE_ENTRY = 0.30
    SCORE_EXIT = 0.22
    SCORE_ENTRY_Q = 0.65
    SCORE_EXIT_Q = 0.35
    RCO_DAYS = int(HL * 0.15)  # 30
    MHP_DAYS = int(HL * 0.30)  # 60
    MA_PERIOD = int(HL * 1.25)  # 250

CB_ACTIVATE = -2.260661127701853
CB_COOLOFF = 0.5006400880184867
COMP_ENTRY_BOOST = 2.000613
USE_BEAR_OVERRIDE = False
USE_MA_FILTER = True

# Ichimoku & Noise Gates parameters
ER_ENTRY = 0.25
ENTROPY_THRESH = 2.40
USE_CLOUD_GATE = True

def super_smoother(series: pd.Series, period: int) -> pd.Series:
    """
    John Ehlers' 2-pole SuperSmoother filter.
    Returns a smoothed pandas Series with the same index.
    """
    if len(series) < 2:
        return series
    
    a1 = np.exp(-1.414 * np.pi / period)
    b1 = 2 * a1 * np.cos(1.414 * np.pi / period)
    c2 = b1
    c3 = -a1 * a1
    c1 = 1.0 - c2 - c3
    
    values = series.values
    out = np.zeros_like(values)
    out[0] = values[0]
    out[1] = values[1]
    
    for t in range(2, len(values)):
        out[t] = c1 * (values[t] + values[t-1]) / 2.0 + c2 * out[t-1] + c3 * out[t-2]
        
    return pd.Series(out, index=series.index)

def calculate_target_exposure(
    smoothed_score_entry: float,
    smoothed_score_exit: float,
    vol: float,
    regime: Optional[str] = None,
    prev_exposure: Optional[float] = None,
    onchain_metrics: Optional[dict] = None,
    composite_value: Optional[float] = None,
    prev_circuit_breaker_active: bool = False,
    days_since_exit: Optional[int] = None,
    days_in_position: Optional[int] = None,
    price: Optional[float] = None,
    ma_val: Optional[float] = None,
    entropy_val: Optional[float] = None,
    er_val: Optional[float] = None,
    cloud_min: Optional[float] = None,
    past_scores: Optional[pd.Series] = None,
) -> Tuple[float, bool]:
    """
    Computes target exposure based on tiered state machine using asymmetric spans, RCO, and MHP.
    HL-driven: thresholds are rolling quantiles 65/35 of past 750d scores if past_scores provided, else fallback to fixed 0.28/0.22.
    Returns (target_exposure, is_circuit_breaker_active).
    """
    # Dynamic quantile thresholds (no hardcode)
    entry_thresh = SCORE_ENTRY
    exit_thresh = SCORE_EXIT
    if past_scores is not None and len(past_scores) >= 100:
        # Use last 750d or all if less
        window = past_scores.tail(750) if len(past_scores) > 750 else past_scores
        entry_thresh = float(window.quantile(SCORE_ENTRY_Q))
        exit_thresh = float(window.quantile(SCORE_EXIT_Q))
        # Clamp to avoid extreme: entry must be > exit
        if entry_thresh <= exit_thresh:
            entry_thresh = SCORE_ENTRY
            exit_thresh = SCORE_EXIT
    prev = prev_exposure if prev_exposure is not None else 0.0
    exposure = prev
    cb_active = prev_circuit_breaker_active

    comp = composite_value if composite_value is not None else 0.0

    # 1. Valuation Circuit Breaker with Cool-off
    if cb_active:
        if comp > CB_COOLOFF:
            cb_active = False
        else:
            return 0.0, True
    else:
        if comp <= CB_ACTIVATE:
            return 0.0, True

    # 2. Score-based entry/exit (Hysteresis with asymmetric spans, MHP and RCO constraints)
    if prev >= 0.9:
        # Check Minimum Holding Period: default to MHP_DAYS to allow exit if not tracked
        effective_days_in_position = days_in_position if days_in_position is not None else MHP_DAYS
        if effective_days_in_position >= MHP_DAYS:
            if smoothed_score_exit <= exit_thresh:
                exposure = 0.0
    else:
        # Check Re-entry cool-off: default to RCO_DAYS to allow entry if not tracked
        effective_days_since_exit = days_since_exit if days_since_exit is not None else RCO_DAYS
        if effective_days_since_exit >= RCO_DAYS:
            ma_condition = True
            if USE_MA_FILTER and price is not None and ma_val is not None:
                ma_condition = (price > ma_val)
                
            # Kaufman Efficiency Ratio Gate
            er_condition = True
            if er_val is not None:
                er_condition = (er_val >= ER_ENTRY)

            # Shannon Entropy Gate
            entropy_condition = True
            if entropy_val is not None:
                entropy_condition = (entropy_val <= ENTROPY_THRESH)

            # Ichimoku Cloud Gate
            cloud_condition = True
            if USE_CLOUD_GATE and cloud_min is not None and price is not None:
                cloud_condition = (price >= cloud_min)

            if smoothed_score_entry >= entry_thresh and ma_condition and er_condition and entropy_condition and cloud_condition:
                exposure = 1.0

    # 3. BEAR regime override
    if USE_BEAR_OVERRIDE and regime == "BEAR":
        exposure = 0.0

    # 4. Composite Value Entry Boost (Deep value accumulation)
    if comp >= COMP_ENTRY_BOOST and exposure == 0.0:
        exposure = 1.0

    # 5. Strict Binary enforcement
    exposure = 1.0 if exposure > 0.5 else 0.0

    return exposure, cb_active
