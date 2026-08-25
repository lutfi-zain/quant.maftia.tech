#!/usr/bin/env python3
"""
Deep dive into all candidate conditions across 2016-2026 and 2018-2026.
Tests:
- Condition 1: Emergency exit only if regime == "BEAR" (HMM confirms structural bear market)
- Condition 2: Emergency exit only if smoothed_score_exit <= -0.30 or -0.35 (true macro collapse)
- Condition 3: Emergency exit if smoothed_score_exit <= -0.25 AND price < ma_val (MA breakdown + negative score)
- Condition 4: No emergency score override, but USE_BEAR_OVERRIDE = True or P(BEAR) > 0.60
- Combined conditions
"""
import os, sys, pickle, sqlite3
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
sys.path.insert(0, LTTD_SRC)
sys.path.insert(0, BASE_DIR)

from scripts.research_emergency_exit_calibration import get_raw_records, simulate_execution, evaluate_trades_and_metrics

raw_records = get_raw_records()

# Test various candidate functions
candidates = {}

# Baseline
def make_exit_fn(score_emergency=None, bear_regime_only=False, bear_prob_emergency=None, require_price_below_ma=False, score_emergency_ma=None):
    def exit_fn(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        # Emergency exit logic
        if score_emergency is not None:
            if smoothed_exit <= score_emergency:
                if bear_regime_only:
                    if regime == "BEAR":
                        return True
                elif require_price_below_ma:
                    if price is not None and ma_val is not None and price < ma_val:
                        return True
                else:
                    return True
                    
        if score_emergency_ma is not None and price is not None and ma_val is not None and price < ma_val:
            if smoothed_exit <= score_emergency_ma:
                return True

        if bear_prob_emergency is not None:
            p_bear = posteriors.get("BEAR", 0.0) if posteriors else 0.0
            if p_bear >= bear_prob_emergency and smoothed_exit <= 0.0:
                return True

        # Standard MHP exit
        if days_in_position >= mhp_days:
            if smoothed_exit <= exit_thresh:
                return True
        return False
    return exit_fn

grid = [
    # Baseline & Current
    ("Baseline (No Emergency)", make_exit_fn(), False, None),
    ("Current (-0.10 Emergency)", make_exit_fn(score_emergency=-0.10), False, None),
    
    # Condition 1: Emergency exit only if regime == "BEAR"
    ("Cond 1a (Score <= -0.10 & Regime == BEAR)", make_exit_fn(score_emergency=-0.10, bear_regime_only=True), False, None),
    ("Cond 1b (Score <= -0.15 & Regime == BEAR)", make_exit_fn(score_emergency=-0.15, bear_regime_only=True), False, None),
    ("Cond 1c (Score <= -0.20 & Regime == BEAR)", make_exit_fn(score_emergency=-0.20, bear_regime_only=True), False, None),
    ("Cond 1d (Score <= 0.00 & Regime == BEAR)", make_exit_fn(score_emergency=0.00, bear_regime_only=True), False, None),
    ("Cond 1e (Score <= exit_thresh & Regime == BEAR)", make_exit_fn(score_emergency=0.22, bear_regime_only=True), False, None),
    
    # Condition 2: Emergency exit only if smoothed_score_exit <= -0.30 or -0.35
    ("Cond 2a (Score <= -0.25)", make_exit_fn(score_emergency=-0.25), False, None),
    ("Cond 2b (Score <= -0.30)", make_exit_fn(score_emergency=-0.30), False, None),
    ("Cond 2c (Score <= -0.35)", make_exit_fn(score_emergency=-0.35), False, None),
    ("Cond 2d (Score <= -0.40)", make_exit_fn(score_emergency=-0.40), False, None),
    
    # Condition 3: Emergency exit if smoothed_score_exit <= -0.25 AND price < ma_val
    ("Cond 3a (Score <= -0.15 & Price < MA)", make_exit_fn(score_emergency=-0.15, require_price_below_ma=True), False, None),
    ("Cond 3b (Score <= -0.20 & Price < MA)", make_exit_fn(score_emergency=-0.20, require_price_below_ma=True), False, None),
    ("Cond 3c (Score <= -0.25 & Price < MA)", make_exit_fn(score_emergency=-0.25, require_price_below_ma=True), False, None),
    ("Cond 3d (Score <= -0.30 & Price < MA)", make_exit_fn(score_emergency=-0.30, require_price_below_ma=True), False, None),
    ("Cond 3e (Score <= -0.10 & Price < MA)", make_exit_fn(score_emergency=-0.10, require_price_below_ma=True), False, None),
    
    # Condition 4: No emergency score override, but USE_BEAR_OVERRIDE = True or P(BEAR) > 0.60
    ("Cond 4a (USE_BEAR_OVERRIDE = True)", make_exit_fn(), True, None),
    ("Cond 4b (P(BEAR) >= 0.50 Override)", make_exit_fn(), False, 0.50),
    ("Cond 4c (P(BEAR) >= 0.60 Override)", make_exit_fn(), False, 0.60),
    ("Cond 4d (P(BEAR) >= 0.70 Override)", make_exit_fn(), False, 0.70),
    ("Cond 4e (P(BEAR) >= 0.80 Override)", make_exit_fn(), False, 0.80),
    
    # Combined smart conditions
    ("Combo 1 (P(BEAR) >= 0.60 & Score <= 0)", make_exit_fn(bear_prob_emergency=0.60), False, None),
    ("Combo 2 (P(BEAR) >= 0.70 & Score <= 0)", make_exit_fn(bear_prob_emergency=0.70), False, None),
    ("Combo 3 (Score <= -0.30 OR (Score <= -0.15 & Price < MA))", 
     lambda smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh: (
         (smoothed_exit <= -0.30) or
         (smoothed_exit <= -0.15 and price is not None and ma_val is not None and price < ma_val) or
         (days_in_position >= mhp_days and smoothed_exit <= exit_thresh)
     ), False, None),
    ("Combo 4 (Score <= -0.25 OR (Regime == BEAR & Score <= 0))", 
     lambda smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh: (
         (smoothed_exit <= -0.25) or
         (regime == "BEAR" and smoothed_exit <= 0.0) or
         (days_in_position >= mhp_days and smoothed_exit <= exit_thresh)
     ), False, None),
    ("Combo 5 (Regime == BEAR & Score <= 0 OR P(BEAR) >= 0.70)", 
     lambda smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh: (
         (regime == "BEAR" and smoothed_exit <= 0.0) or
         ((posteriors or {}).get("BEAR", 0.0) >= 0.70 and smoothed_exit <= 0.10) or
         (days_in_position >= mhp_days and smoothed_exit <= exit_thresh)
     ), False, None),
]

for date_label, s_date, e_date in [("2016-2026 (Full Evaluation)", "2016-01-01", "2026-08-25"), ("2018-2026 (Studio Default)", "2018-01-01", "2026-08-25")]:
    print("\n" + "=" * 115)
    print(f"=== EVALUATION WINDOW: {date_label} ===")
    print("=" * 115)
    print(f"{'Condition':<52} | {'Trades':<6} | {'WinRate':<8} | {'ProfitFac':<9} | {'MaxDD':<7} | {'Sharpe':<6} | {'AnnRet':<7}")
    print("-" * 115)
    
    for name, fn, bear_ov, p_bear in grid:
        df_sim = simulate_execution(raw_records, fn, use_bear_override=bear_ov, bear_override_prob=p_bear)
        metrics = evaluate_trades_and_metrics(df_sim, start_date=s_date, end_date=e_date)
        print(f"{name:<52} | {metrics['totalTrades']:<6} | {metrics['winRate']:<7.2f}% | {metrics['profitFactor']:<9.2f} | {metrics['maxDrawdown']:<6.2f}% | {metrics['sharpe']:<6.2f} | {metrics['annReturn']:<6.2f}%")

