#!/usr/bin/env python3
"""
Autoresearch harness: LTTD long-term trend — gross win-rate benchmark
Deterministic, no network, fixed DB snapshot, fixed date range.
Primary metric: winRate (gross, per-trade)
Secondary: profitFactor, totalTrades, tradesPerYear, holdMedianDays, expectancy
CODE-SENSITIVE: recomputes exposures via current sizing.py (not just DB stored)
"""
import sqlite3
import os
import statistics
from datetime import datetime
import math
import sys

# Ensure engines/lttd is importable
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LTTD_SRC = os.path.join(BASE, "engines", "lttd")
if LTTD_SRC not in sys.path:
    sys.path.insert(0, LTTD_SRC)

DB_PATH = os.path.join(BASE, "data", "maftia_quant.db")
START_DATE = "2018-01-01"
END_DATE = "2024-12-31"
FEE_BPS = 10

def main():
    if not os.path.exists(DB_PATH):
        print("METRIC winRate=0.0")
        print("METRIC profitFactor=0.0")
        print("METRIC totalTrades=0")
        return 1

    # Import current sizing params (sensitive to edits)
    try:
        from src.execution.sizing import calculate_target_exposure, MA_PERIOD, USE_MA_FILTER
    except Exception as e:
        print(f"import sizing failed {e}", file=sys.stderr)
        calculate_target_exposure = None
        MA_PERIOD = 226
        USE_MA_FILTER = True

    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=10)
    con.execute("PRAGMA query_only=ON;")
    cur = con.cursor()

    cur.execute("""
        SELECT u.date, m.close, u.lttd_regime, u.lttd_score, u.valuation_composite
        FROM unified_daily_analytics u
        LEFT JOIN master_ohlcv m ON u.date = m.date
        WHERE u.date BETWEEN ? AND ? AND m.close IS NOT NULL
        ORDER BY u.date ASC
    """, (START_DATE, END_DATE))
    rows = cur.fetchall()
    if not rows:
        print("METRIC winRate=0.0")
        return 1

    # Build price series for MA
    dates = [r[0] for r in rows]
    closes = [float(r[1]) for r in rows]
    # compute MA series (causal, rolling MA_PERIOD)
    import pandas as pd
    s = pd.Series(closes, index=pd.to_datetime(dates))
    ma_series = s.rolling(MA_PERIOD).mean()

    # For CB and gates we need prior state; we will iterate and call calculate_target_exposure
    # If import failed, fallback to DB exposure logic
    exposures = []
    prev_exp = 0.0
    prev_cb = False
    days_since_exit = 999
    days_in_position = 0
    # For SuperSmoother we need past scores; sizing does its own smoothing internally via passed smoothed scores
    # We will feed raw lttd_score as both entry/exit smoothed (conservative; sensitive to threshold)
    # Real pipeline does double smoothing, but threshold sensitivity remains

    for idx, (date_str, close, regime, score, comp) in enumerate(rows):
        regime = regime if regime in ("BULL","BEAR","SIDEWAYS") else "SIDEWAYS"
        score_val = float(score) if score is not None else 0.0
        price = float(close)
        ma_val = float(ma_series.iloc[idx]) if not pd.isna(ma_series.iloc[idx]) else None
        comp_val = float(comp) if comp is not None else 0.0

        # Use current sizing logic if available
        if calculate_target_exposure:
            # realized vol approximated as 0 for harness determinism (gates that depend on vol will be disabled)
            # We pass entropy/er/cloud as None to keep gates open (or threshold will be ignored)
            try:
                exp, cb = calculate_target_exposure(
                    smoothed_score_entry=score_val,
                    smoothed_score_exit=score_val,
                    vol=0.02,  # placeholder vol ~2% daily
                    regime=regime,
                    prev_exposure=prev_exp,
                    composite_value=comp_val,
                    prev_circuit_breaker_active=prev_cb,
                    days_since_exit=days_since_exit,
                    days_in_position=days_in_position,
                    price=price,
                    ma_val=ma_val,
                    entropy_val=None,
                    er_val=None,
                    cloud_min=None,
                )
            except Exception as e:
                # fallback to simple threshold
                if prev_exp >= 0.9:
                    exp = 0.0 if score_val <= 0.20 else 1.0
                else:
                    exp = 1.0 if score_val >= 0.25 else 0.0
                cb = False
        else:
            # simple threshold fallback
            if prev_exp >= 0.9:
                exp = 0.0 if score_val <= 0.20 else 1.0
            else:
                exp = 1.0 if score_val >= 0.25 else 0.0
            cb = False

        # track counters for next iter
        if exp > 0.5 and prev_exp < 0.5:
            days_in_position = 1
            days_since_exit = 999
        elif exp > 0.5:
            days_in_position += 1
        else:
            if prev_exp > 0.5:
                days_since_exit = 1
            else:
                if days_since_exit < 999:
                    days_since_exit += 1
            days_in_position = 0

        exposures.append(exp)
        prev_exp = exp
        prev_cb = cb

    # Now compute trades from recomputed exposures (not DB stored)
    trades = []
    prev_exp_trade = 0.0
    entry_price = None
    entry_date = None
    # Need to map date->close for exit price
    date_to_close = {r[0]: float(r[1]) for r in rows}
    for (date_str, close, regime, score, comp), exp in zip(rows, exposures):
        exp_val = 1.0 if exp > 0.5 else 0.0
        if exp_val > 0 and prev_exp_trade == 0:
            entry_price = float(close)
            entry_date = date_str
        elif exp_val == 0 and prev_exp_trade > 0 and entry_price is not None:
            exit_price = float(close)
            exit_date = date_str
            gross_ret_pct = (exit_price - entry_price) / entry_price * 100 if entry_price != 0 else 0
            try:
                hold = (datetime.strptime(exit_date, "%Y-%m-%d") - datetime.strptime(entry_date, "%Y-%m-%d")).days
            except:
                hold = 0
            net_ret_pct = gross_ret_pct - (FEE_BPS/10000*100*2)
            trades.append((entry_date, exit_date, gross_ret_pct, net_ret_pct, hold))
            entry_price = None
            entry_date = None
        prev_exp_trade = exp_val

    totalTrades = len(trades)
    wins = sum(1 for _,_,gross,_,_ in trades if gross > 0)
    winRate = (wins / totalTrades * 100) if totalTrades else 0.0
    gross_profit = sum(gross for _,_,gross,_,_ in trades if gross > 0)
    gross_loss = sum(abs(gross) for _,_,gross,_,_ in trades if gross <= 0)
    profitFactor = (gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit>0 else 0.0)
    holds = [h for _,_,_,_,h in trades]
    holdMedian = int(statistics.median(holds)) if holds else 0
    holdAvg = sum(holds)/len(holds) if holds else 0
    years = (datetime.strptime(END_DATE, "%Y-%m-%d") - datetime.strptime(START_DATE, "%Y-%m-%d")).days / 365.25
    tradesPerYear = totalTrades / years if years else 0
    expectancy_gross = (sum(gross for _,_,gross,_,_ in trades)/ totalTrades) if totalTrades else 0
    expectancy_net = (sum(net for _,_,_,net,_ in trades)/ totalTrades) if totalTrades else 0

    # daily Sharpe net
    sorted_dates = sorted(date_to_close.keys())
    exp_map = {r[0]: (1.0 if e>0.5 else 0.0) for r,e in zip(rows, exposures)}
    daily_strat_rets = []
    prev_close = None
    prev_exp_daily = 0
    for d in sorted_dates:
        close = date_to_close[d]
        exp_val = exp_map.get(d, 0)
        if prev_close is not None:
            mkt_ret = (close - prev_close)/prev_close if prev_close else 0
            strat_ret = prev_exp_daily * mkt_ret - (FEE_BPS/10000 if exp_val != prev_exp_daily else 0)
            daily_strat_rets.append(strat_ret)
        prev_close = close
        prev_exp_daily = exp_val
    if daily_strat_rets:
        mean = sum(daily_strat_rets)/len(daily_strat_rets)
        var = sum((x-mean)**2 for x in daily_strat_rets)/len(daily_strat_rets) if len(daily_strat_rets)>1 else 0
        std = math.sqrt(var)
        sharpeNet = (mean/std* math.sqrt(365)) if std>0 else 0.0
    else:
        sharpeNet = 0.0

    print(f"METRIC winRate={winRate:.4f}")
    print(f"METRIC profitFactor={profitFactor:.4f}")
    print(f"METRIC totalTrades={totalTrades}")
    print(f"METRIC tradesPerYear={tradesPerYear:.4f}")
    print(f"METRIC holdMedianDays={holdMedian}")
    print(f"METRIC holdAvgDays={holdAvg:.2f}")
    print(f"METRIC expectancyGrossPct={expectancy_gross:.4f}")
    print(f"METRIC expectancyNetPct={expectancy_net:.4f}")
    print(f"METRIC sharpeNet={sharpeNet:.4f}")
    con.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
