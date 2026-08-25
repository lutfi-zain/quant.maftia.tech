#!/usr/bin/env python3
"""
Research & Calibration script for LTTD Emergency Exit.
Tests baseline, -0.10, and candidate conditions on 2016-2026.
"""
import os
import sys
import pickle
import time
import sqlite3
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE_DIR, "engines", "lttd")
if LTTD_SRC not in sys.path:
    sys.path.insert(0, LTTD_SRC)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.backtest.runner import BacktestRunner
from src.execution.sizing import super_smoother

CACHE_FILE = "/tmp/lttd_raw_records_pca_consensus.pkl"

def get_raw_records():
    if os.path.exists(CACHE_FILE):
        print(f"Loading raw records from cache: {CACHE_FILE}")
        with open(CACHE_FILE, "rb") as f:
            return pickle.load(f)
            
    print("Generating raw records with BacktestRunner(ensemble_mode='pca_consensus')...")
    db_path = os.path.join(BASE_DIR, "data", "maftia_quant.db")
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    df_full = pd.read_sql_query("SELECT date as time, open, high, low, close, volume FROM master_ohlcv ORDER BY date ASC", con)
    con.close()
    df_full['time'] = pd.to_datetime(df_full['time'])
    df_full = df_full.set_index('time').sort_index()
    
    # We run the runner up to unique_raw_records
    runner = BacktestRunner(ensemble_mode="pca_consensus")
    
    # Extract unique_raw_records by running the pipeline
    from src.ensemble.wfo import WFOEnsemble
    from src.features.builder import FeatureMatrixBuilder
    from src.data.target_loader import load_regime_targets
    from src.backtest.wfo import WFOIterator
    from src.backtest.runner import _run_fold
    import concurrent.futures
    
    log_prices = np.log(df_full["close"])
    dynamic_lookback = WFOEnsemble().run_wfo_calibration(
        log_prices, df_full.index[0], df_full.index[-1], legacy_fixed_window=False
    )
    builder = FeatureMatrixBuilder(dynamic_lookback=dynamic_lookback)
    feature_matrix = builder.build_matrix(df_full).dropna()
    common_idx = df_full.index.intersection(feature_matrix.index).sort_values()
    df_merged = df_full.loc[common_idx]
    feature_matrix = feature_matrix.loc[common_idx]
    y = load_regime_targets(df_merged.index, close_series=df_merged["close"]).loc[common_idx]
    
    iterator = WFOIterator(purge_days=60)
    folds = list(iterator.generate_wfo_folds(common_idx))
    raw_records = []
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(_run_fold, train_idx, val_idx, test_idx, df_merged, feature_matrix, y, ensemble_mode="pca_consensus")
            for train_idx, val_idx, test_idx in folds
        ]
        for f in concurrent.futures.as_completed(futures):
            raw_records.extend(f.result())
            
    raw_records = sorted(raw_records, key=lambda x: x["date"])
    seen_dates = set()
    unique_raw_records = []
    for r in raw_records:
        d = r["date"]
        if d not in seen_dates:
            seen_dates.add(d)
            unique_raw_records.append(r)
            
    print(f"Caching {len(unique_raw_records)} unique raw records to {CACHE_FILE}")
    with open(CACHE_FILE, "wb") as f:
        pickle.dump(unique_raw_records, f)
        
    return unique_raw_records

def simulate_execution(raw_records, exit_rule_fn, use_bear_override=False, bear_override_prob=None):
    """
    Simulates sizing & execution given a custom exit_rule_fn.
    exit_rule_fn signature: (smoothed_exit, regime, posteriors, price, ma_val, days_in_position, MHP_DAYS, exit_thresh) -> bool (True = EXIT)
    """
    HL = 200
    SUPERSMOOTHER_PERIOD_ENTRY = int(HL * 0.175) # 35
    SUPERSMOOTHER_PERIOD_EXIT = int(HL * 0.10)   # 20
    SCORE_ENTRY = 0.30
    SCORE_EXIT = 0.22
    SCORE_ENTRY_Q = 0.65
    SCORE_EXIT_Q = 0.35
    RCO_DAYS = int(HL * 0.15)  # 30
    MHP_DAYS = int(HL * 0.30)  # 60
    MA_PERIOD = int(HL * 1.25) # 250
    
    CB_ACTIVATE = -2.260661127701853
    CB_COOLOFF = 0.5006400880184867
    COMP_ENTRY_BOOST = 2.000613
    USE_MA_FILTER = True
    ER_ENTRY = 0.25
    ENTROPY_THRESH = 2.40
    USE_CLOUD_GATE = True
    
    records = []
    prev_exposure = 0.0
    cb_active = False
    days_in_position = 0
    days_since_exit = 999
    
    past_scores = []
    
    for r in raw_records:
        date_str = r["date_str"]
        final_score = r["final_score"]
        regime = r["regime"]
        posteriors = r.get("posteriors") or {}
        comp = r.get("composite_value", 0.0)
        price = r.get("price", r.get("close", 0.0))
        ma_val = r.get("ma_val")
        er_val = r.get("er_val")
        entropy_val = r.get("entropy_val")
        cloud_min = r.get("cloud_min")
        close = r.get("close", price)
        
        # Track timers
        if prev_exposure >= 0.9:
            days_in_position += 1
            days_since_exit = 0
        else:
            days_in_position = 0
            days_since_exit += 1
            
        past_scores.append(final_score)
        scores_series = pd.Series(past_scores)
        
        smoothed_entry = float(super_smoother(scores_series, period=SUPERSMOOTHER_PERIOD_ENTRY).iloc[-1])
        smoothed_exit = float(super_smoother(scores_series, period=SUPERSMOOTHER_PERIOD_EXIT).iloc[-1])
        
        entry_thresh = SCORE_ENTRY
        exit_thresh = SCORE_EXIT
        if len(scores_series) >= 100:
            window = scores_series.tail(750) if len(scores_series) > 750 else scores_series
            entry_thresh = float(window.quantile(SCORE_ENTRY_Q))
            exit_thresh = float(window.quantile(SCORE_EXIT_Q))
            if entry_thresh <= exit_thresh:
                entry_thresh = SCORE_ENTRY
                exit_thresh = SCORE_EXIT
                
        exposure = prev_exposure
        
        # 1. Valuation Circuit Breaker
        if cb_active:
            if comp > CB_COOLOFF:
                cb_active = False
            else:
                exposure = 0.0
        else:
            if comp <= CB_ACTIVATE:
                cb_active = True
                exposure = 0.0
                
        if not cb_active:
            # 2. Score-based entry/exit
            if prev_exposure >= 0.9:
                effective_days_in_position = days_in_position
                
                # Check custom exit rule
                should_exit = exit_rule_fn(
                    smoothed_exit=smoothed_exit,
                    regime=regime,
                    posteriors=posteriors,
                    price=price,
                    ma_val=ma_val,
                    days_in_position=effective_days_in_position,
                    mhp_days=MHP_DAYS,
                    exit_thresh=exit_thresh
                )
                if should_exit:
                    exposure = 0.0
            else:
                effective_days_since_exit = days_since_exit
                if effective_days_since_exit >= RCO_DAYS:
                    ma_condition = True
                    if USE_MA_FILTER and price is not None and ma_val is not None:
                        ma_condition = (price > ma_val)
                    er_condition = True
                    if er_val is not None:
                        er_condition = (er_val >= ER_ENTRY)
                    entropy_condition = True
                    if entropy_val is not None:
                        entropy_condition = (entropy_val <= ENTROPY_THRESH)
                    cloud_condition = True
                    if USE_CLOUD_GATE and cloud_min is not None and price is not None:
                        cloud_condition = (price >= cloud_min)
                        
                    if smoothed_entry >= entry_thresh and ma_condition and er_condition and entropy_condition and cloud_condition:
                        exposure = 1.0
                        
            # 3. BEAR regime override
            if use_bear_override:
                if regime == "BEAR":
                    exposure = 0.0
            if bear_override_prob is not None:
                p_bear = posteriors.get("BEAR", 0.0)
                if p_bear >= bear_override_prob:
                    exposure = 0.0
                    
            # 4. Composite Value Entry Boost
            if comp >= COMP_ENTRY_BOOST and exposure == 0.0:
                exposure = 1.0
                
        # 5. Strict Binary enforcement
        exposure = 1.0 if exposure > 0.5 else 0.0
        prev_exposure = exposure
        
        records.append({
            "date": pd.Timestamp(r["date"]),
            "date_str": date_str,
            "close": close,
            "final_score": final_score,
            "smoothed_entry": smoothed_entry,
            "smoothed_exit": smoothed_exit,
            "regime": regime,
            "posteriors": posteriors,
            "price": price,
            "ma_val": ma_val,
            "target_exposure": exposure,
            "days_in_position": days_in_position,
            "days_since_exit": days_since_exit,
        })
        
    return pd.DataFrame(records).set_index("date")

def evaluate_trades_and_metrics(df, start_date="2016-01-01", end_date="2026-08-25", fee_bps=10):
    mask = (df.index >= pd.Timestamp(start_date)) & (df.index <= pd.Timestamp(end_date))
    df_eval = df[mask].copy()
    
    if df_eval.empty:
        return {"totalTrades": 0, "winRate": 0, "profitFactor": 0, "trades": []}
        
    fee_rate = fee_bps / 10000.0
    
    # Calculate daily returns and equity curve
    daily_strat_returns = []
    daily_market_returns = []
    equity = 1.0
    peak_equity = 1.0
    max_dd = 0.0
    
    trades = []
    in_trade = False
    entry_price = 0.0
    entry_date = None
    prev_exposure = 0.0
    prev_close = None
    
    for i, (date, row) in enumerate(df_eval.iterrows()):
        close = row["close"]
        exposure = row["target_exposure"]
        
        if prev_close is not None and prev_close > 0:
            m_ret = (close - prev_close) / prev_close
            daily_market_returns.append(m_ret)
            
            fee_cost = 0.0
            if exposure > 0 and prev_exposure == 0:
                fee_cost = fee_rate
            elif exposure == 0 and prev_exposure > 0:
                fee_cost = fee_rate
                
            s_ret = prev_exposure * m_ret - fee_cost
            daily_strat_returns.append(s_ret)
            
            equity = equity * (1.0 + s_ret)
            if equity > peak_equity:
                peak_equity = equity
            dd = (peak_equity - equity) / peak_equity
            if dd > max_dd:
                max_dd = dd
                
        # Trade log detection
        if exposure > 0 and prev_exposure == 0:
            in_trade = True
            entry_price = close
            entry_date = date
        elif exposure == 0 and prev_exposure > 0:
            in_trade = False
            exit_price = close
            exit_date = date
            ret_pct = ((exit_price - entry_price) / entry_price) * 100.0
            hold_days = (exit_date - entry_date).days
            trades.append({
                "entry_date": entry_date.strftime("%Y-%m-%d"),
                "entry_price": entry_price,
                "exit_date": exit_date.strftime("%Y-%m-%d"),
                "exit_price": exit_price,
                "hold_days": hold_days,
                "return_pct": ret_pct,
                "exit_regime": row["regime"],
                "smoothed_exit": row["smoothed_exit"]
            })
            
        prev_exposure = exposure
        prev_close = close
        
    total_trades = len(trades)
    win_trades = sum(1 for t in trades if t["return_pct"] > 0)
    win_rate = (win_trades / total_trades * 100.0) if total_trades > 0 else 0.0
    
    gross_profit = sum(t["return_pct"] for t in trades if t["return_pct"] > 0)
    gross_loss = sum(abs(t["return_pct"]) for t in trades if t["return_pct"] <= 0)
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)
    
    n = len(daily_strat_returns)
    years = n / 365.25
    ann_return = (equity ** (1.0 / years) - 1.0) * 100.0 if (years > 0 and equity > 0) else 0.0
    mean_ret = np.mean(daily_strat_returns) if n > 0 else 0.0
    std_ret = np.std(daily_strat_returns) if n > 0 else 0.0
    ann_vol = std_ret * np.sqrt(365) * 100.0
    sharpe = (ann_return / ann_vol) if ann_vol > 0 else 0.0
    
    return {
        "totalTrades": total_trades,
        "winTrades": win_trades,
        "winRate": win_rate,
        "profitFactor": profit_factor,
        "totalReturn": (equity - 1.0) * 100.0,
        "annReturn": ann_return,
        "sharpe": sharpe,
        "maxDrawdown": max_dd * 100.0,
        "trades": trades
    }

if __name__ == "__main__":
    print("=== STARTING LTTD EMERGENCY EXIT CALIBRATION BENCHMARK ===")
    raw_records = get_raw_records()
    print(f"Total raw records loaded: {len(raw_records)}")
    
    # Define exit rule factories
    
    # 1. Baseline: Standard MHP without emergency exit
    def exit_baseline(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False
        
    # 2. Flawed Emergency Exit (-0.10)
    def exit_flawed_10(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.10:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False
        
    # 3. Condition 1: Emergency exit only if regime == "BEAR" (HMM confirms structural bear market)
    def exit_cond1_bear_regime(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if regime == "BEAR" and smoothed_exit <= 0.0:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False
        
    # 4. Condition 2a: Emergency exit only if smoothed_score_exit <= -0.30
    def exit_cond2_30(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.30:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # Condition 2b: Emergency exit only if smoothed_score_exit <= -0.35
    def exit_cond2_35(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.35:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False
        
    # Condition 2c: Emergency exit only if smoothed_score_exit <= -0.25
    def exit_cond2_25(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.25:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # 5. Condition 3: Emergency exit if smoothed_score_exit <= -0.25 AND price < ma_val
    def exit_cond3(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.25 and price is not None and ma_val is not None and price < ma_val:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # Condition 3b: Emergency exit if smoothed_score_exit <= -0.20 AND price < ma_val
    def exit_cond3b(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.20 and price is not None and ma_val is not None and price < ma_val:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # Condition 3c: Emergency exit if smoothed_score_exit <= -0.30 AND price < ma_val
    def exit_cond3c(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.30 and price is not None and ma_val is not None and price < ma_val:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # Condition 3d: Emergency exit if smoothed_score_exit <= -0.15 AND price < ma_val
    def exit_cond3d(smoothed_exit, regime, posteriors, price, ma_val, days_in_position, mhp_days, exit_thresh):
        if smoothed_exit <= -0.15 and price is not None and ma_val is not None and price < ma_val:
            return True
        if days_in_position >= mhp_days:
            return smoothed_exit <= exit_thresh
        return False

    # 6. Condition 4: No emergency score override, but USE_BEAR_OVERRIDE = True or P(BEAR) > 0.60
    # Tested via simulation flags
    
    experiments = [
        ("Baseline (No Emergency Exit)", exit_baseline, False, None),
        ("Flawed (Emergency Exit <= -0.10)", exit_flawed_10, False, None),
        ("Cond 1 (Regime == BEAR & score <= 0)", exit_cond1_bear_regime, False, None),
        ("Cond 2a (Emergency Exit <= -0.30)", exit_cond2_30, False, None),
        ("Cond 2b (Emergency Exit <= -0.35)", exit_cond2_35, False, None),
        ("Cond 2c (Emergency Exit <= -0.25)", exit_cond2_25, False, None),
        ("Cond 3a (Score <= -0.25 AND Price < MA)", exit_cond3, False, None),
        ("Cond 3b (Score <= -0.20 AND Price < MA)", exit_cond3b, False, None),
        ("Cond 3c (Score <= -0.30 AND Price < MA)", exit_cond3c, False, None),
        ("Cond 3d (Score <= -0.15 AND Price < MA)", exit_cond3d, False, None),
        ("Cond 4a (USE_BEAR_OVERRIDE = True)", exit_baseline, True, None),
        ("Cond 4b (P(BEAR) >= 0.60 Override)", exit_baseline, False, 0.60),
        ("Cond 4c (P(BEAR) >= 0.70 Override)", exit_baseline, False, 0.70),
    ]
    
    print("\n" + "=" * 100)
    print(f"{'Condition':<38} | {'Trades':<6} | {'WinRate':<8} | {'ProfitFac':<9} | {'MaxDD':<7} | {'Sharpe':<6} | {'AnnRet':<7}")
    print("=" * 100)
    
    results = {}
    for name, fn, bear_ov, p_bear in experiments:
        df_sim = simulate_execution(raw_records, fn, use_bear_override=bear_ov, bear_override_prob=p_bear)
        metrics = evaluate_trades_and_metrics(df_sim, start_date="2016-01-01", end_date="2026-08-25")
        results[name] = {"metrics": metrics, "df": df_sim}
        print(f"{name:<38} | {metrics['totalTrades']:<6} | {metrics['winRate']:<7.2f}% | {metrics['profitFactor']:<9.2f} | {metrics['maxDrawdown']:<6.2f}% | {metrics['sharpe']:<6.2f} | {metrics['annReturn']:<6.2f}%")
        
    print("=" * 100)
    
    # Detailed trade comparison between Baseline and Flawed (-0.10)
    print("\n\n=== TRADE COMPARISON: Baseline vs Flawed (-0.10) ===")
    base_trades = results["Baseline (No Emergency Exit)"]["metrics"]["trades"]
    flawed_trades = results["Flawed (Emergency Exit <= -0.10)"]["metrics"]["trades"]
    
    print(f"\nBaseline Trades ({len(base_trades)}):")
    for i, t in enumerate(base_trades, 1):
        print(f"  Trade {i:02d}: Entry {t['entry_date']} (${t['entry_price']:,.0f}) -> Exit {t['exit_date']} (${t['exit_price']:,.0f}) | Hold: {t['hold_days']:3d}d | Return: {t['return_pct']:+7.2f}% | Exit Regime: {t['exit_regime']}")
        
    print(f"\nFlawed (-0.10) Trades ({len(flawed_trades)}):")
    for i, t in enumerate(flawed_trades, 1):
        print(f"  Trade {i:02d}: Entry {t['entry_date']} (${t['entry_price']:,.0f}) -> Exit {t['exit_date']} (${t['exit_price']:,.0f}) | Hold: {t['hold_days']:3d}d | Return: {t['return_pct']:+7.2f}% | Exit Regime: {t['exit_regime']}")
        
    # Save benchmark results
    with open("/tmp/lttd_calibration_results.pkl", "wb") as f:
        pickle.dump(results, f)
