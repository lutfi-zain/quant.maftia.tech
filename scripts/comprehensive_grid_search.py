#!/usr/bin/env python3
"""
Comprehensive Grid Search on Emergency Exit Parameters and Conditions
"""
import os, sys, pickle
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
sys.path.insert(0, LTTD_SRC)
sys.path.insert(0, BASE_DIR)

from scripts.fast_candidate_eval import raw_records, evaluate_metrics, smoothed_entries, smoothed_exits, entry_thresh_arr, exit_thresh_arr

HL = 200
MHP_DAYS = int(HL * 0.30)  # 60
RCO_DAYS = int(HL * 0.15)  # 30
CB_ACTIVATE = -2.260661127701853
CB_COOLOFF = 0.5006400880184867
COMP_ENTRY_BOOST = 2.000613
ER_ENTRY = 0.25
ENTROPY_THRESH = 2.40
USE_CLOUD_GATE = True
USE_MA_FILTER = True

def simulate_grid(score_emerg, req_bear=False, req_ma=False, bear_or_ma=False, p_bear_thresh=None):
    n = len(raw_records)
    exposures = np.zeros(n)
    prev_exp = 0.0
    cb_active = False
    days_in_pos = 0
    days_since_exit = 999
    
    for i in range(n):
        r = raw_records[i]
        comp = r.get("composite_value", 0.0)
        price = r.get("price", r.get("close", 0.0))
        ma_val = r.get("ma_val")
        er_val = r.get("er_val")
        entropy_val = r.get("entropy_val")
        cloud_min = r.get("cloud_min")
        regime = r["regime"]
        posteriors = r.get("posteriors") or {}
        
        sm_entry = smoothed_entries[i]
        sm_exit = smoothed_exits[i]
        entry_th = entry_thresh_arr[i]
        exit_th = exit_thresh_arr[i]
        
        if prev_exp >= 0.9:
            days_in_pos += 1
            days_since_exit = 0
        else:
            days_in_pos = 0
            days_since_exit += 1
            
        exp = prev_exp
        
        if cb_active:
            if comp > CB_COOLOFF:
                cb_active = False
            else:
                exp = 0.0
        else:
            if comp <= CB_ACTIVATE:
                cb_active = True
                exp = 0.0
                
        if not cb_active:
            if prev_exp >= 0.9:
                is_emerg = False
                if score_emerg is not None and sm_exit <= score_emerg:
                    if req_bear:
                        is_emerg = (regime == "BEAR")
                    elif req_ma:
                        is_emerg = (price is not None and ma_val is not None and price < ma_val)
                    elif bear_or_ma:
                        is_emerg = (regime == "BEAR") or (price is not None and ma_val is not None and price < ma_val)
                    else:
                        is_emerg = True
                        
                if p_bear_thresh is not None and posteriors.get("BEAR", 0.0) >= p_bear_thresh:
                    if score_emerg is not None:
                        if sm_exit <= score_emerg:
                            is_emerg = True
                    else:
                        is_emerg = True
                        
                if is_emerg:
                    exp = 0.0
                elif days_in_pos >= MHP_DAYS and sm_exit <= exit_th:
                    exp = 0.0
            else:
                if days_since_exit >= RCO_DAYS:
                    ma_ok = True
                    if USE_MA_FILTER and price is not None and ma_val is not None:
                        ma_ok = (price > ma_val)
                    er_ok = True
                    if er_val is not None:
                        er_ok = (er_val >= ER_ENTRY)
                    ent_ok = True
                    if entropy_val is not None:
                        ent_ok = (entropy_val <= ENTROPY_THRESH)
                    cld_ok = True
                    if USE_CLOUD_GATE and cloud_min is not None and price is not None:
                        cld_ok = (price >= cloud_min)
                        
                    if sm_entry >= entry_th and ma_ok and er_ok and ent_ok and cld_ok:
                        exp = 1.0
                        
            if comp >= COMP_ENTRY_BOOST and exp == 0.0:
                exp = 1.0
                
        exp = 1.0 if exp > 0.5 else 0.0
        prev_exp = exp
        exposures[i] = exp
        
    return exposures

results = []

# Test grid
for score in [-0.40, -0.35, -0.30, -0.25, -0.20, -0.15, -0.10, -0.05, 0.00, 0.10, 0.22]:
    # 1. BEAR regime only
    exps = simulate_grid(score, req_bear=True)
    m = evaluate_metrics(exps, start_date="2016-01-01", end_date="2026-08-25")
    results.append(("Regime==BEAR & score<=" + str(score), m))
    
    # 2. Unconditional
    exps = simulate_grid(score, req_bear=False)
    m = evaluate_metrics(exps, start_date="2016-01-01", end_date="2026-08-25")
    results.append(("Unconditional score<=" + str(score), m))
    
    # 3. Price < MA
    exps = simulate_grid(score, req_ma=True)
    m = evaluate_metrics(exps, start_date="2016-01-01", end_date="2026-08-25")
    results.append(("Price<MA & score<=" + str(score), m))

    # 4. BEAR or Price < MA
    exps = simulate_grid(score, bear_or_ma=True)
    m = evaluate_metrics(exps, start_date="2016-01-01", end_date="2026-08-25")
    results.append(("BEAR or Price<MA & score<=" + str(score), m))

# Sort results by ProfitFactor desc, then WinRate desc
results = sorted(results, key=lambda x: (x[1]["winRate"] >= 76.5, x[1]["profitFactor"], x[1]["sharpe"]), reverse=True)

print(f"{'Condition':<45} | {'Trades':<6} | {'WinRate':<8} | {'ProfitFac':<9} | {'MaxDD':<7} | {'Sharpe':<6} | {'AnnRet':<7}")
print("=" * 105)
for name, m in results[:25]:
    print(f"{name:<45} | {m['totalTrades']:<6} | {m['winRate']:<7.2f}% | {m['profitFactor']:<9.2f} | {m['maxDrawdown']:<6.2f}% | {m['sharpe']:<6.2f} | {m['annReturn']:<6.2f}%")
