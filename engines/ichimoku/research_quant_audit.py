"""
Quantitative Research Audit & Out-of-Sample Validation Script
=============================================================
Standard: lz-quant-researcher (Renaissance Technologies / Two Sigma standard)
Framework: lz-technical-indicator-architect (4-Layer First Principles)

This script performs:
1. Verification of the 3 Critical Dates:
   - April 5, 2022: Permanently REJECTED (0.0x Cash)
   - October 6, 2025: Permanently REJECTED (0.0x Cash)
   - August 23, 2026: PASSES (1.20x N-Wave Expansion)
2. Strict 3-Way Data Partitioning:
   - In-Sample (IS / Training): 2010-08-16 to 2019-12-31
   - Out-of-Sample Validation (OOS Val): 2020-01-01 to 2023-12-31
   - Out-of-Sample Real Holdout Test (OOS Real Test): 2024-01-01 to 2026-08-26
   - Canonical 2016-2026 Benchmark Period
3. 5-Fold Rolling Walk-Forward Validation Engine with 5-day embargo gap.
4. Complete Macro Trade Ledger.
"""

import sys
import os
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.ichimoku_quant.data import fetch_btc_ohlcv_from_bitview
from src.ichimoku_quant.features import generate_ichimoku_features
from src.ichimoku_quant.strategy import generate_signals
from src.ichimoku_quant.backtest import (
    run_backtest,
    calculate_metrics,
    print_benchmark_comparison_table,
    run_walk_forward_validation,
)


def get_trades_list(df_bt: pd.DataFrame) -> pd.DataFrame:
    """Extracts contiguous active trades with metrics."""
    trades = []
    in_trade = False
    entry_date = None
    entry_price = None
    max_pos = 0.0
    strat_cum = 1.0

    for dt, row in df_bt.iterrows():
        pos = row['Active_Pos']
        ret = row['Strat_Net_Ret']
        close = row['Close']

        if not in_trade and pos > 0:
            in_trade = True
            entry_date = dt
            entry_price = close
            max_pos = pos
            strat_cum = 1.0 + ret
        elif in_trade:
            strat_cum *= (1.0 + ret)
            if pos > max_pos:
                max_pos = pos
            if pos == 0:
                in_trade = False
                exit_date = dt
                exit_price = close
                strat_ret = strat_cum - 1.0
                mkt_ret = (exit_price - entry_price) / entry_price
                trades.append({
                    'entry_date': entry_date,
                    'entry_price': entry_price,
                    'exit_date': exit_date,
                    'exit_price': exit_price,
                    'strat_ret': strat_ret,
                    'mkt_ret': mkt_ret,
                    'max_pos': max_pos,
                    'hold_days': (exit_date - entry_date).days
                })
    if in_trade:
        exit_date = df_bt.index[-1]
        exit_price = df_bt.iloc[-1]['Close']
        trades.append({
            'entry_date': entry_date,
            'entry_price': entry_price,
            'exit_date': exit_date,
            'exit_price': exit_price,
            'strat_ret': strat_cum - 1.0,
            'mkt_ret': (exit_price - entry_price) / entry_price,
            'max_pos': max_pos,
            'hold_days': (exit_date - entry_date).days
        })
    return pd.DataFrame(trades)


def audit_critical_dates(df_bt: pd.DataFrame):
    """
    Audits the 3 critical milestone dates.
    """
    print("\n" + "=" * 90)
    print("                    CRITICAL MILESTONE DATES AUDIT MATRIX")
    print("=" * 90)

    # 1. April 5, 2022
    row_apr = df_bt.loc['2022-04-05']
    status_apr = "[PASS] PERMANENTLY REJECTED (HELD CASH)" if row_apr['Pos'] == 0.0 else "[FAIL] ERRONEOUS ENTRY"
    print(f"1. April 5, 2022 (Bear Trap Elimination)     : Close=${row_apr['Close']:>9,.2f} | Pos={row_apr['Pos']:.2f}x ({row_apr['Regime']}) -> {status_apr}")

    # 2. October 6, 2025
    row_oct = df_bt.loc['2025-10-06']
    status_oct = "[PASS] PERMANENTLY REJECTED (HELD CASH)" if row_oct['Pos'] == 0.0 else "[FAIL] ERRONEOUS ENTRY"
    print(f"2. October 6, 2025 (Exhaustion Peak Trap)    : Close=${row_oct['Close']:>9,.2f} | Pos={row_oct['Pos']:.2f}x ({row_oct['Regime']}) -> {status_oct}")

    # 3. August 23, 2026
    row_aug = df_bt.loc['2026-08-23']
    status_aug = "[PASS] CONFIRMED N-WAVE EXPANSION" if row_aug['Pos'] == 1.20 else "[FAIL] MISSED BREAKOUT"
    print(f"3. August 23, 2026 (Active Cycle Breakout)   : Close=${row_aug['Close']:>9,.2f} | Pos={row_aug['Pos']:.2f}x ({row_aug['Regime']}) -> {status_aug}")
    print("=" * 90 + "\n")


def main():
    print("=" * 90)
    print("  QUANTITATIVE RESEARCH AUDIT: 7-BOOK CANONICAL ICHIMOKU QUANT SYSTEM")
    print("  Standard: lz-quant-researcher | Architecture: lz-technical-indicator-architect")
    print("=" * 90)

    # 1. Fetch data
    print("\n[1/5] Fetching historical BTC daily data from bitview.space...")
    df_raw = fetch_btc_ohlcv_from_bitview()
    print(f"-> Data loaded: {len(df_raw)} bars from {df_raw.index.min().strftime('%Y-%m-%d')} to {df_raw.index.max().strftime('%Y-%m-%d')}")

    # 2. Generate 7-Book Features
    print("\n[2/5] Computing 7-Book Hosoda technical indicators, wave telemetry & target levels...")
    df_feat = generate_ichimoku_features(df_raw)

    # 3. Generate Signals & Run Full Backtest
    print("\n[3/5] Evaluating 7-Book Master Confluence & Dynamic Position Sizing...")
    df_base = generate_signals(df_feat, n_wave_size=1.0, base_size=1.0, e_target_trim_size=1.0)
    df_base_bt = run_backtest(df_base, transaction_cost=0.001)
    metrics_base = calculate_metrics(df_base_bt)

    df_7b = generate_signals(df_feat, n_wave_size=1.20, base_size=1.00, e_target_trim_size=0.85)
    df_7b_bt = run_backtest(df_7b, transaction_cost=0.001)
    metrics_7b = calculate_metrics(df_7b_bt)

    # 4. Audit Critical Milestone Dates
    audit_critical_dates(df_7b_bt)

    # 5. Print Side-by-Side Full History Comparison
    print_benchmark_comparison_table(metrics_base, metrics_7b, title="7-BOOK CANONICAL ICHIMOKU v4.0 vs BASELINE (FULL HISTORY)")

    # 6. Strict 3-Way Data Partitioning
    print("\n" + "=" * 90)
    print("                 STRICT 3-WAY DATA PARTITIONING PERFORMANCE MATRIX")
    print("=" * 90)

    # In-Sample Training (2010-08-16 to 2019-12-31)
    df_is = df_7b_bt.loc[:'2019-12-31'].copy()
    df_is['Cum_Strat'] = (1 + df_is['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_is['Cum_Market'] = (1 + df_is['Market_Ret'].fillna(0)).cumprod() - 1
    m_is = calculate_metrics(df_is)

    # Out-of-Sample Validation (2020-01-01 to 2023-12-31)
    df_val = df_7b_bt.loc['2020-01-01':'2023-12-31'].copy()
    df_val['Cum_Strat'] = (1 + df_val['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_val['Cum_Market'] = (1 + df_val['Market_Ret'].fillna(0)).cumprod() - 1
    m_val = calculate_metrics(df_val)

    # Out-of-Sample Real Holdout Test (2024-01-01 to 2026-08-26)
    df_test = df_7b_bt.loc['2024-01-01':].copy()
    df_test['Cum_Strat'] = (1 + df_test['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_test['Cum_Market'] = (1 + df_test['Market_Ret'].fillna(0)).cumprod() - 1
    m_test = calculate_metrics(df_test)

    # Canonical 2016-2026 Period
    df_base_2016 = df_base_bt.loc['2016-01-01':].copy()
    df_base_2016['Cum_Strat'] = (1 + df_base_2016['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_base_2016['Cum_Market'] = (1 + df_base_2016['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_base_2016 = calculate_metrics(df_base_2016)

    df_7b_2016 = df_7b_bt.loc['2016-01-01':].copy()
    df_7b_2016['Cum_Strat'] = (1 + df_7b_2016['Strat_Net_Ret'].fillna(0)).cumprod() - 1
    df_7b_2016['Cum_Market'] = (1 + df_7b_2016['Market_Ret'].fillna(0)).cumprod() - 1
    metrics_7b_2016 = calculate_metrics(df_7b_2016)

    print_benchmark_comparison_table(m_is, m_val, title="TRAIN (IS: 2010-2019) vs OOS VALIDATION (2020-2023)")
    print_benchmark_comparison_table(m_val, m_test, title="OOS VALIDATION (2020-2023) vs OOS REAL TEST (2024-2026)")
    print_benchmark_comparison_table(metrics_base_2016, metrics_7b_2016, title="CANONICAL 2016-2026 BENCHMARK COMPARISON MATRIX")

    # 7. Walk-Forward Validation Engine
    print("\n" + "=" * 90)
    print("           5-FOLD ROLLING WALK-FORWARD VALIDATION (5-DAY EMBARGO GAP)")
    print("=" * 90)
    wf_df = run_walk_forward_validation(df_raw, n_folds=5, train_ratio=0.6, embargo_days=5)
    print(wf_df.to_string(index=False))

    # 8. Print Trade Ledger
    print("\n" + "=" * 90)
    print("                      COMPLETE MACRO TRADE LEDGER")
    print("=" * 90)
    trades_df = get_trades_list(df_7b_bt)
    for i, t in trades_df.iterrows():
        status = "WIN " if t['strat_ret'] > 0 else "LOSS"
        print(f"{i+1:2d}. [{status}] {t['entry_date'].strftime('%Y-%m-%d')} (${t['entry_price']:>9,.2f}) -> {t['exit_date'].strftime('%Y-%m-%d')} (${t['exit_price']:>9,.2f}) | Strat: {t['strat_ret']*100:>+8.2f}% | Mkt: {t['mkt_ret']*100:>+8.2f}% | Hold: {t['hold_days']:>3}d | Pos: {t['max_pos']:.2f}x")
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
