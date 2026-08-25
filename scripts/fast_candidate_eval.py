#!/usr/bin/env python3
"""
Fast vectorized candidate evaluation script.
Precalculates supersmoothed scores and quantiles once,
then benchmarks all exit conditions in milliseconds.
"""
import os, sys, pickle
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
sys.path.insert(0, LTTD_SRC)
sys.path.insert(0, BASE_DIR)

from src.execution.sizing import super_smoother

CACHE_FILE = "/tmp/lttd_raw_records_pca_consensus.pkl"
with open(CACHE_FILE, "rb") as f:
    raw_records = pickle.load(f)

# Precalculate supersmoother and quantiles
HL = 200
PERIOD_ENTRY = int(HL * 0.175) # 35
PERIOD_EXIT = int(HL * 0.10)   # 20
SCORE_ENTRY = 0.30
SCORE_EXIT = 0.22
SCORE_ENTRY_Q = 0.65
SCORE_EXIT_Q = 0.35
RCO_DAYS = int(HL * 0.15)  # 30
MHP_DAYS = int(HL * 0.30)  # 60
CB_ACTIVATE = -2.260661127701853
CB_COOLOFF = 0.5006400880184867
COMP_ENTRY_BOOST = 2.000613
ER_ENTRY = 0.25
ENTROPY_THRESH = 2.40
USE_CLOUD_GATE = True
USE_MA_FILTER = True

scores_list = [r["final_score"] for r in raw_records]
scores_series = pd.Series(scores_list)
smoothed_entries = super_smoother(scores_series, period=PERIOD_ENTRY).values
smoothed_exits = super_smoother(scores_series, period=PERIOD_EXIT).values

# Precalculate rolling quantiles
entry_thresh_arr = np.full(len(raw_records), SCORE_ENTRY)
exit_thresh_arr = np.full(len(raw_records), SCORE_EXIT)

for i in range(len(raw_records)):
    if i >= 100:
        win_start = max(0, i + 1 - 750)
        win = scores_series.iloc[win_start:i+1]
        e_th = float(win.quantile(SCORE_ENTRY_Q))
        x_th = float(win.quantile(SCORE_EXIT_Q))
        if e_th > x_th:
            entry_thresh_arr[i] = e_th
            exit_thresh_arr[i] = x_th

def run_simulation(exit_cond_fn, use_bear_override=False, bear_prob_override=None):
    n = len(raw_records)
    exposures = np.zeros(n)
    days_in_pos_arr = np.zeros(n, dtype=int)
    days_since_exit_arr = np.zeros(n, dtype=int)
    
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
        
        # Timer tracking
        if prev_exp >= 0.9:
            days_in_pos += 1
            days_since_exit = 0
        else:
            days_in_pos = 0
            days_since_exit += 1
            
        exp = prev_exp
        
        # 1. Valuation Circuit Breaker
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
            # 2. Score-based entry/exit
            if prev_exp >= 0.9:
                should_exit = exit_cond_fn(
                    sm_exit=sm_exit,
                    regime=regime,
                    posteriors=posteriors,
                    price=price,
                    ma_val=ma_val,
                    days_in_pos=days_in_pos,
                    mhp_days=MHP_DAYS,
                    exit_th=exit_th
                )
                if should_exit:
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
                        
            # 3. BEAR override
            if use_bear_override and regime == "BEAR":
                exp = 0.0
            if bear_prob_override is not None:
                if posteriors.get("BEAR", 0.0) >= bear_prob_override:
                    exp = 0.0
                    
            # 4. Composite Value Entry Boost
            if comp >= COMP_ENTRY_BOOST and exp == 0.0:
                exp = 1.0
                
        # 5. Strict binary
        exp = 1.0 if exp > 0.5 else 0.0
        prev_exp = exp
        exposures[i] = exp
        days_in_pos_arr[i] = days_in_pos
        days_since_exit_arr[i] = days_since_exit
        
    return exposures

def evaluate_metrics(exposures, start_date="2016-01-01", end_date="2026-08-25", fee_bps=10):
    fee_rate = fee_bps / 10000.0
    
    dates = [pd.Timestamp(r["date"]) for r in raw_records]
    closes = [r["close"] for r in raw_records]
    
    trades = []
    daily_rets = []
    equity = 1.0
    peak_equity = 1.0
    max_dd = 0.0
    
    in_trade = False
    entry_price = 0.0
    entry_date = None
    prev_exp = 0.0
    prev_close = None
    
    s_dt = pd.Timestamp(start_date)
    e_dt = pd.Timestamp(end_date)
    
    for i in range(len(raw_records)):
        dt = dates[i]
        if dt < s_dt or dt > e_dt:
            continue
            
        close = closes[i]
        exp = exposures[i]
        
        if prev_close is not None and prev_close > 0:
            m_ret = (close - prev_close) / prev_close
            fee_cost = 0.0
            if exp > 0 and prev_exp == 0:
                fee_cost = fee_rate
            elif exp == 0 and prev_exp > 0:
                fee_cost = fee_rate
                
            s_ret = prev_exp * m_ret - fee_cost
            daily_rets.append(s_ret)
            
            equity *= (1.0 + s_ret)
            if equity > peak_equity:
                peak_equity = equity
            dd = (peak_equity - equity) / peak_equity
            if dd > max_dd:
                max_dd = dd
                
        if exp > 0 and prev_exp == 0:
            in_trade = True
            entry_price = close
            entry_date = dt
        elif exp == 0 and prev_exp > 0:
            in_trade = False
            exit_price = close
            exit_date = dt
            ret_pct = ((exit_price - entry_price) / entry_price) * 100.0
            hold_days = (exit_date - entry_date).days
            trades.append({
                "entryDate": entry_date.strftime("%Y-%m-%d"),
                "entryPrice": entry_price,
                "exitDate": exit_date.strftime("%Y-%m-%d"),
                "exitPrice": exit_price,
                "returnPct": ret_pct,
                "holdDays": hold_days,
                "regime": raw_records[i]["regime"]
            })
            
        prev_exp = exp
        prev_close = close
        
    total_trades = len(trades)
    win_trades = sum(1 for t in trades if t["returnPct"] > 0)
    win_rate = (win_trades / total_trades * 100.0) if total_trades > 0 else 0.0
    gross_p = sum(t["returnPct"] for t in trades if t["returnPct"] > 0)
    gross_l = sum(abs(t["returnPct"]) for t in trades if t["returnPct"] <= 0)
    profit_factor = (gross_p / gross_l) if gross_l > 0 else (999.0 if gross_p > 0 else 0.0)
    
    n = len(daily_rets)
    years = n / 365.25
    ann_ret = (equity ** (1.0 / years) - 1.0) * 100.0 if (years > 0 and equity > 0) else 0.0
    mean_ret = np.mean(daily_rets) if n > 0 else 0.0
    std_ret = np.std(daily_rets) if n > 0 else 0.0
    ann_vol = std_ret * np.sqrt(365) * 100.0
    sharpe = (ann_ret / ann_vol) if ann_vol > 0 else 0.0
    
    return {
        "totalTrades": total_trades,
        "winTrades": win_trades,
        "winRate": win_rate,
        "profitFactor": profit_factor,
        "maxDrawdown": max_dd * 100.0,
        "sharpe": sharpe,
        "annReturn": ann_ret,
        "totalReturn": (equity - 1.0) * 100.0,
        "trades": trades
    }

# Define exit conditions to test
conditions = [
    # Baseline
    ("Baseline (Standard MHP only, No emergency)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), False, None),
     
    # Flawed current
    ("Current (Emergency <= -0.10)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.10 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),
     
    # Condition 1: Emergency exit only if regime == "BEAR" (HMM confirms structural bear market)
    ("Cond 1a (Score <= -0.10 & Regime == BEAR)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.10 and regime == "BEAR") or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),
     
    ("Cond 1b (Score <= 0.00 & Regime == BEAR)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= 0.00 and regime == "BEAR") or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),
     
    ("Cond 1c (Score <= exit_th & Regime == BEAR)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= exit_th and regime == "BEAR") or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),
     
    ("Cond 1d (Regime == BEAR, any score)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (regime == "BEAR") or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    # Condition 2: Emergency exit only if smoothed_score_exit <= -0.30 or -0.35 (true macro collapse)
    ("Cond 2a (Score <= -0.20)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.20 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 2b (Score <= -0.25)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.25 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 2c (Score <= -0.30)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.30 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 2d (Score <= -0.35)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.35 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 2e (Score <= -0.40)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.40 or (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    # Condition 3: Emergency exit if smoothed_score_exit <= -0.25 AND price < ma_val
    ("Cond 3a (Score <= -0.15 & Price < MA)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.15 and price is not None and ma_val is not None and price < ma_val) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 3b (Score <= -0.20 & Price < MA)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.20 and price is not None and ma_val is not None and price < ma_val) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 3c (Score <= -0.25 & Price < MA)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.25 and price is not None and ma_val is not None and price < ma_val) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Cond 3d (Score <= -0.30 & Price < MA)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.30 and price is not None and ma_val is not None and price < ma_val) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    # Condition 4: No emergency score override, but USE_BEAR_OVERRIDE = True or P(BEAR) > 0.60
    ("Cond 4a (USE_BEAR_OVERRIDE = True)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), True, None),

    ("Cond 4b (P(BEAR) >= 0.50 Override)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), False, 0.50),

    ("Cond 4c (P(BEAR) >= 0.60 Override)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), False, 0.60),

    ("Cond 4d (P(BEAR) >= 0.70 Override)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), False, 0.70),

    ("Cond 4e (P(BEAR) >= 0.80 Override)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         days_in_pos >= mhp_days and sm_exit <= exit_th
     ), False, 0.80),

    # Combinations
    ("Combo 1 (Regime == BEAR & Score <= 0)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (regime == "BEAR" and sm_exit <= 0.0) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Combo 2 (P(BEAR) >= 0.60 & Score <= 0)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (posteriors.get("BEAR", 0.0) >= 0.60 and sm_exit <= 0.0) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Combo 3 (Score <= -0.30 OR (Regime == BEAR & Score <= 0))",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         sm_exit <= -0.30 or
         (regime == "BEAR" and sm_exit <= 0.0) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),

    ("Combo 4 (Score <= -0.25 & Price < MA OR Regime == BEAR)",
     lambda sm_exit, regime, posteriors, price, ma_val, days_in_pos, mhp_days, exit_th: (
         (sm_exit <= -0.25 and price is not None and ma_val is not None and price < ma_val) or
         (regime == "BEAR" and sm_exit <= 0.0) or
         (days_in_pos >= mhp_days and sm_exit <= exit_th)
     ), False, None),
]

for label, s_dt, e_dt in [
    ("2016-01-01 to 2026-08-25 (Autoresearch Benchmark Window)", "2016-01-01", "2026-08-25"),
    ("2018-01-01 to 2026-08-25 (LTTD Lab Default Window)", "2018-01-01", "2026-08-25"),
    ("Full Out-Of-Fold (2017-09 to 2026-08)", "2017-01-01", "2026-08-25")
]:
    print("\n" + "=" * 115)
    print(f"=== WINDOW: {label} ===")
    print("=" * 115)
    print(f"{'Condition Name':<55} | {'Trades':<6} | {'WinRate':<8} | {'ProfitFac':<9} | {'MaxDD':<7} | {'Sharpe':<6} | {'AnnRet':<7}")
    print("-" * 115)
    
    for name, fn, bear_ov, p_bear in conditions:
        exps = run_simulation(fn, use_bear_override=bear_ov, bear_prob_override=p_bear)
        m = evaluate_metrics(exps, start_date=s_dt, end_date=e_dt)
        print(f"{name:<55} | {m['totalTrades']:<6} | {m['winRate']:<7.2f}% | {m['profitFactor']:<9.2f} | {m['maxDrawdown']:<6.2f}% | {m['sharpe']:<6.2f} | {m['annReturn']:<6.2f}%")

