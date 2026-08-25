#!/usr/bin/env python3
"""
Trade-by-trade comparison for top candidate exit conditions.
"""
import os, sys, pickle
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
sys.path.insert(0, LTTD_SRC)
sys.path.insert(0, BASE_DIR)

from scripts.fast_candidate_eval import (
    raw_records,
    run_simulation,
    evaluate_metrics,
    conditions
)

selected_names = [
    "Baseline (Standard MHP only, No emergency)",
    "Current (Emergency <= -0.10)",
    "Cond 1a (Score <= -0.10 & Regime == BEAR)",
    "Cond 1b (Score <= 0.00 & Regime == BEAR)",
    "Cond 4c (P(BEAR) >= 0.60 Override)",
    "Cond 4d (P(BEAR) >= 0.70 Override)",
    "Combo 2 (P(BEAR) >= 0.60 & Score <= 0)",
]

selected_conds = [c for c in conditions if c[0] in selected_names]

for name, fn, bear_ov, p_bear in selected_conds:
    exps = run_simulation(fn, use_bear_override=bear_ov, bear_prob_override=p_bear)
    m = evaluate_metrics(exps, start_date="2016-01-01", end_date="2026-08-25")
    
    print("\n" + "=" * 105)
    print(f"=== {name} ===")
    print(f"Total Trades: {m['totalTrades']} | Win Rate: {m['winRate']:.2f}% | Profit Factor: {m['profitFactor']:.2f} | Max DD: {m['maxDrawdown']:.2f}% | Sharpe: {m['sharpe']:.2f} | Ann Ret: {m['annReturn']:.2f}%")
    print("-" * 105)
    print(f"{'#':<3} | {'Entry Date':<10} | {'Entry Px':<10} | {'Exit Date':<10} | {'Exit Px':<10} | {'Hold':<5} | {'Return %':<9} | {'Exit Regime':<10}")
    print("-" * 105)
    for i, t in enumerate(m["trades"], 1):
        print(f"{i:02d}  | {t['entryDate']} | ${t['entryPrice']:>9,.0f} | {t['exitDate']} | ${t['exitPrice']:>9,.0f} | {t['holdDays']:>3d}d | {t['returnPct']:>+8.2f}% | {t['regime']}")
